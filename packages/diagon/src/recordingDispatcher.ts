
import { clearModified, Next, ensureProxy, Patch, Mutator, PatchHandler } from '.';
import { commitPatches } from './diagon';
import { createPipeline, Middleware, Pipeline } from './middleware';

export interface DispatchContext<T extends object = object, TPatchHandlerState extends object = object> {
    state: T;
    patches?: Patch[];
    patchHandlerState?: TPatchHandlerState;
    patchesFromPatchHandler?: Patch[];
    patchesFromGlobalPatchHandler?: Patch[];
    commandResult?: any;
    pipelineStackDepth?: number;
}

export type AsyncMutator<TState extends object, TArgs extends unknown[], R> =
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, TState>) |
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, unknown>);

//TODO: reorder state parameters with state, then mutator.
export interface RecordingDispatcher {
    pipeline: Pipeline<DispatchContext>;
    mutate: <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs) => R;
    mutateWithPatches: <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
        state: TState,
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        ...args: TArgs
    ) => R;
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
            //Record the depth of the calls to mutate() / mutateAsync() at the start of this pipeline's execution to avoid double recording.
            //  each pipeline records this at the start of their execution.
            context.pipelineStackDepth = callstackDepth;
            try {
                callstackDepth++;
                next();
            }
            finally {
                callstackDepth--;
            }
        },
        ...middlewares);

    const mutate = <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs): R => {
        const context: DispatchContext<TState> = {
            state,
        };

        pipeline.execute(context, (context, next) => {
            if (context.pipelineStackDepth === 0) {
                try {
                    clearModified();
                    const stateProxy = ensureProxy(context.state as TState);
                    context.commandResult = mutator(stateProxy, ...args);
                    context.patches = commitPatches();
                }
                finally {
                    clearModified();
                }
            } else {
                const stateProxy = ensureProxy(context.state as TState);
                context.commandResult = mutator(stateProxy, ...args);
            }
            next();
        });

        return context.commandResult as R;
    };

    const mutateWithPatches = <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
        state: TState,
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        ...args: TArgs): R => {

        const context: DispatchContext<TState> = {
            state,
            patchHandlerState
        };

        pipeline.execute(context, (context, next) => {
            if (context.pipelineStackDepth === 0) {
                try {
                    clearModified();

                    const stateProxy = ensureProxy(context.state as TState);

                    const result = mutator(stateProxy, ...args);
                    const patches = commitPatches();
                    context.patches = patches;
                    context.commandResult = result;

                    clearModified();

                    const patchHandlerStateProxy = ensureProxy(context.patchHandlerState as TPatchHandlerState);
                    patchHandler(patchHandlerStateProxy, patches, stateProxy, result, ...args);

                    context.patchesFromPatchHandler = commitPatches();
                }
                finally {
                    clearModified();
                }
            } else {
                console.error('Attempting to observe patches in a nested mutator.  Patch handler will not be run.');
                const stateProxy = ensureProxy(context.state as TState);
                context.commandResult = mutator(stateProxy, ...args);
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
        mutateWithPatches,
        createMutator,
        mutateAsync,
        executingAsyncOperations,
        cancelAllAsyncOperations,
    };
}

export const configureGlobalPatchRecording = <TPatchHandlerState extends object, TState extends object>(
    patchHandlerState: TPatchHandlerState,
    patchHandler: (patchHandlerState: TPatchHandlerState, patches: Patch[], state: TState) => void) =>
    (context: DispatchContext, next: Next) => {
        next();
        if (context.pipelineStackDepth === 0 && context.patches) {
            try {
                clearModified();
                const patchHandlerStateProxy = ensureProxy(patchHandlerState);
                const stateProxy = ensureProxy(context.state as TState);
                patchHandler(patchHandlerStateProxy, context.patches, stateProxy);
                context.patchesFromGlobalPatchHandler = commitPatches();
            }
            finally {
                clearModified();
            }                        
        } 
    };