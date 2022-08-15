import { clearContext, createContext, createRecordingProxy, Patch, Mutator, tryGetProxy } from '.';
import { commitPatches } from './diagon';
import { createPipeline, Middleware, Next, Pipeline } from './middleware';

export interface DispatchContext<T extends object = object> {
    state: T;
    stateProxy?: T;
    patches?: Patch[];
    commandResult?: any;
    callstackDepth?: number;
}

// export type AsyncMutatorGenerator<R, TState extends object> = AsyncGenerator<unknown, R, TState>;
export type AsyncMutator<TState extends object, TArgs extends unknown[], R> =
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, TState>) |
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, unknown>);

export interface RecordingDispatcher {
    pipeline: Pipeline<DispatchContext>;
    mutate: <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs) => R;
    createMutator: <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>) => Mutator<TState, TArgs, R>;
    mutateAsync: <TState extends object, TArgs extends unknown[], R>(asyncMutator: AsyncMutator<TState, TArgs, R>, state: TState, ...args: TArgs) => Promise<R>;

    executingAsyncOperations: Set<AsyncGenerator>;
    cancelAllAsyncOperations: () => Promise<unknown>;
}

export function createRecordingDispatcher(...middlewares: Middleware<DispatchContext>[]): RecordingDispatcher {
    // This is the depth of the mutate() / mutateAsync() callstack so that a pipeline executed while another pipeline is running can
    // detect if it can skip a new set of change recording.
    let callstackDepth = 0;

    const pipeline = createPipeline(
        (context, next) => {
            // console.log('callstackDepth', callstackDepth);
            //Record the depth of the calls to mutate() / mutateAsync() at the start of this pipelines execution to avoid double recording.
            //  each pipeline records this at the start of their execution.
            context.callstackDepth = callstackDepth;
            try {
                callstackDepth++;
                next();
            }
            finally {
                callstackDepth--;
            }
        },
        ...middlewares);

    pipeline.push(recordChangesMiddleware);

    const mutate = <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs): R => {
        const context: DispatchContext<TState> = {
            state,
        };

        pipeline.execute(context, (context, next) => {
            if (context.stateProxy) {
                //This cast is safe-ish.  It is expected that the type of the stateProxy should not be changed by the middleware.                 
                context.commandResult = mutator(context.stateProxy as TState, ...args);
            }
            next();
        });

        return context.commandResult as R;
    };

    const createMutator = <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>) =>
        (state: TState, ...args: TArgs) => mutate(mutator, state, ...args);

    const executingAsyncOperations = new Set<AsyncGenerator>();

    const mutateAsync = async <TState extends object, TArgs extends unknown[], R>(asyncMutator: AsyncMutator<TState, TArgs, R>, state: TState, ...args: TArgs): Promise<R> => {
        let coroutine: ReturnType<AsyncMutator<TState, TArgs, R>> | undefined = undefined;

        try {
            let result = await mutate(stateProxy => {
                coroutine = asyncMutator(stateProxy, ...args);
                executingAsyncOperations.add(coroutine);
                return coroutine.next(stateProxy);
            }, state);

            if (!executingAsyncOperations.has(coroutine!)) {
                throw new Error('async operation was cancelled externally');
            }

            while (!result.done) {
                result = await mutate(stateProxy => coroutine!.next(stateProxy), state);
                if (!executingAsyncOperations.has(coroutine!)) {
                    throw new Error('async operation was cancelled externally');
                }
            }
            return result.value;
        } finally {
            executingAsyncOperations.delete(coroutine!);
        }
    };

    const cancelAllAsyncOperations = async () => {
        const currentOperations = Array.from(executingAsyncOperations);
        executingAsyncOperations.clear();

        return Promise.allSettled(currentOperations.map(operation => operation.throw(new Error('cancel'))));
    };

    return {
        pipeline,
        mutate,
        createMutator,
        mutateAsync,
        executingAsyncOperations,
        cancelAllAsyncOperations,
    };
}

export const recordChangesMiddleware = (context: DispatchContext, next: Next) => {
    if (context.callstackDepth === 0) {
        try {
            createContext();
            context.stateProxy = tryGetProxy(context.state) || createRecordingProxy(context.state);
            next();
            context.patches = commitPatches();
        }
        finally {
            clearContext();
        }
    } else {
        context.stateProxy = tryGetProxy(context.state) || createRecordingProxy(context.state);
        next();
    }
};
