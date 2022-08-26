import { createSubscribingRecorder, DispatchContext, Middleware, Next, SubscribingRecorder, ensureProxy } from 'diagon';
import { create } from 'domain';
import ReactDOM from 'react-dom';
import { createRecorderHooks, ReactHooks } from './reactHooks';

export interface ReactStore<TState> extends SubscribingRecorder {
    state: TState,
}

export const configureReact = () => (context: DispatchContext, next: Next) => {
    next();

    if (context.pipelineStackDepth === 0) {

        const callbacksToFire = context.callbacksToFire;
        if (callbacksToFire && callbacksToFire?.size > 0) {
            ReactDOM.unstable_batchedUpdates(() => {
                if (callbacksToFire) {
                    for (const callback of callbacksToFire) {
                        callback();
                    }
                }
            });
        }
    }
};

//Middleware Ordering
// Stack increment
// react or other callbacks executor
// Subscription commitment
// GlobalPatchRecorder
// Recorder mutate
// Mutator

export type ReactRecorder = ReturnType<typeof createReactRecorder>

export function createReactRecorder(...middleware: Middleware<DispatchContext>[]) {
    const recorder = createSubscribingRecorder(configureReact(), ...middleware);
    return { ...recorder, ...createRecorderHooks(recorder) };
}

export function createReactStore<TState extends object>(state: TState, recorder?: SubscribingRecorder): ReactStore<TState> {
    return {
        state: ensureProxy(state),
        ...(recorder || createReactRecorder())
    };
}