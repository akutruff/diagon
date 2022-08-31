
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

export type CreateMutator = {
    <TState extends object, TArgs extends unknown[], R>(mutator: Mutator<TState, TArgs, R>): (state: TState, ...args: TArgs) => R
    <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>): (...args: TArgs) => R
};

export interface MutateWithPatches {
    <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
        state: TState,
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        ...args: TArgs
    ): R;
}

//TODO: reorder state parameters with state, then mutator.
export interface Recorder {
    pipeline: Pipeline<DispatchContext>;
    mutate: <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, ...args: TArgs) => R;
    mutateWithPatches: MutateWithPatches;
    createMutator: CreateMutator;
}

export function createRecorder(...middlewares: Middleware<DispatchContext>[]): Recorder {
    // This is the depth of the mutate() callstack so that a pipeline executed while another pipeline is running can
    // detect if it can skip a new set of change recording.
    let callstackDepth = 0;

    const pipeline = createPipeline(
        (context, next) => {

            //Record the depth of the calls to mutate() at the start of this pipeline's execution to avoid double recording.
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

    const createMutator: CreateMutator = <TState extends object, TArgs extends unknown[], R>(stateOrMutator: TState | Mutator<TState, TArgs, R>, mutator?: Mutator<TState, TArgs, R>) => {
        return mutator !== undefined ?
            (...args: TArgs) => mutate(stateOrMutator as TState, mutator, ...args)
            : (state: TState, ...args: TArgs) => mutate(state, stateOrMutator as Mutator<TState, TArgs, R>, ...args);
    };

    return {
        pipeline,
        mutate,
        mutateWithPatches,
        createMutator,
    };
}

