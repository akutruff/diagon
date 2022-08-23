
import { ensureProxy, Patch, Mutator, PatchHandler } from '.';
import { clearModified, endRecording } from './diagon';
import { createPipeline, Middleware, Pipeline } from './middleware';

export interface DispatchContext<T extends object = object, TPatchHandlerState extends object = object> {
    state: T;
    patches?: Patch[];
    patchHandlerState?: TPatchHandlerState;
    commandResult?: any;
    pipelineStackDepth?: number;
    allPatchSetsFromPipeline: Patch[][];
    callbacksToFire?: Set<any>;
}

export type AsyncMutator<TState extends object, TArgs extends unknown[], R> =
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, TState>) |
    ((state: TState, ...args: TArgs) => AsyncGenerator<unknown, R, unknown>);

export type CreateMutator = {
    <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>): (state: TState, ...args: TArgs) => R
    <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>): (...args: TArgs) => R
};

//TODO: reorder state parameters with state, then mutator.
export interface Recorder {
    pipeline: Pipeline<DispatchContext>;
    mutate: <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, ...args: TArgs) => R;
    mutateWithPatches: <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
        state: TState,
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        ...args: TArgs
    ) => R;
    createMutator: CreateMutator;
    mutateAsync: <TState extends object, TArgs extends unknown[], R>(state: TState, asyncMutator: AsyncMutator<TState, TArgs, R>, ...args: TArgs) => Promise<R>;
    executingAsyncOperations: Set<AsyncGenerator>;
    cancelAllAsyncOperations: () => Promise<unknown>;
}

//TODO: reorder state parameters with state, then mutator.
export interface BoundRecorder<TState extends object> {
    recorder: Recorder,
    state: TState,
    mutate: <TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>, ...args: TArgs) => R;
    mutateWithPatches: <TPatchHandlerState extends object, TArgs extends unknown[], R>(
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        ...args: TArgs
    ) => R;
    createMutator: CreateMutator;
    mutateAsync: <TArgs extends unknown[], R>(asyncMutator: AsyncMutator<TState, TArgs, R>, ...args: TArgs) => Promise<R>;
    cancelAllAsyncOperations: () => Promise<unknown>;
}

export function createRecorder(...middlewares: Middleware<DispatchContext>[]): Recorder {
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

    const mutate = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, ...args: TArgs): R => {
        const context: DispatchContext<TState> = {
            state,
            allPatchSetsFromPipeline: []
        };

        pipeline.execute(context, (context, next) => {
            if (context.pipelineStackDepth === 0) {
                try {
                    clearModified();
                    const stateProxy = ensureProxy(context.state as TState);
                    context.commandResult = mutator(stateProxy, ...args);
                    const patches = endRecording();
                    context.patches = patches;
                    context.allPatchSetsFromPipeline.push(patches);
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
            patchHandlerState,
            allPatchSetsFromPipeline: [],
            callbacksToFire: new Set<any>(),
        };

        pipeline.execute(context, (context, next) => {
            if (context.pipelineStackDepth === 0) {
                try {
                    clearModified();

                    const stateProxy = ensureProxy(context.state as TState);

                    const result = mutator(stateProxy, ...args);
                    const patches = endRecording();
                    context.commandResult = result;
                    context.patches = patches;
                    context.allPatchSetsFromPipeline.push(patches);
                    clearModified();

                    const patchHandlerStateProxy = ensureProxy(context.patchHandlerState as TPatchHandlerState);
                    patchHandler(patchHandlerStateProxy, patches, stateProxy, result, ...args);

                    context.allPatchSetsFromPipeline.push(endRecording());
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

    const createMutator: CreateMutator = <TState extends object, TArgs extends unknown[], R>(state: TState | Mutator<TState, TArgs, R>, mutator?: Mutator<TState, TArgs, R>) => {
        return mutator !== undefined ?
            (...args: TArgs) => mutate(state as TState, mutator, ...args)
            : (st: TState, ...args: TArgs) => mutate(st, state as Mutator<TState, TArgs, R>, ...args);
    };

    const executingAsyncOperations = new Set<AsyncGenerator>();

    const mutateAsync = async <TState extends object, TArgs extends unknown[], R>(state: TState, asyncMutator: AsyncMutator<TState, TArgs, R>, ...args: TArgs): Promise<R> => {
        let coroutine: ReturnType<AsyncMutator<TState, TArgs, R>> | undefined = undefined;

        try {
            let result = await mutate(state, stateProxy => {
                coroutine = asyncMutator(stateProxy, ...args);
                executingAsyncOperations.add(coroutine);
                return coroutine.next(stateProxy);
            });

            if (!executingAsyncOperations.has(coroutine!)) {
                throw new Error('async operation was cancelled externally');
            }

            while (!result.done) {
                result = await mutate(state, stateProxy => coroutine!.next(stateProxy));
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

