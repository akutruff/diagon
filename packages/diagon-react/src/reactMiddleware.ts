import { createSubscribingRecorder, DispatchContext, Middleware, Next, SubscribingRecorder } from 'diagon';
import ReactDOM from 'react-dom';

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

export function createReactRecorder(...middleware: Middleware<DispatchContext>[]): SubscribingRecorder {
    return createSubscribingRecorder(configureReact(), ...middleware);
}

export function createReactStore<TState>(state: TState, recorder?: SubscribingRecorder): ReactStore<TState> {
    return {
        state,
        ...(recorder || createReactRecorder())
    };
}