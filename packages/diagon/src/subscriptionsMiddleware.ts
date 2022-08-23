import { commitPatches, createRecorder, createSubscriptionStore, DispatchContext, Middleware, Next, Recorder, SubscriptionStore } from '.';

export const configureSubscriptions = (subStore: SubscriptionStore) => (context: DispatchContext, next: Next) => {
    next();

    if (context.pipelineStackDepth === 0) {
        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        subStore.version++;

        const allPatches = context.allPatchSetsFromPipeline.flat();
        if (allPatches.length > 0) {
            context.callbacksToFire = commitPatches(subStore, allPatches);
        } else {
            context.callbacksToFire = undefined;
        }
    }
};

export interface SubscribingRecorder extends Recorder {
    subStore: SubscriptionStore
}

export function createSubscribingRecorder(callbackDispatchingMiddleware: Middleware<DispatchContext>, ...middleware: Middleware<DispatchContext>[]) {
    const subStore = createSubscriptionStore();
    const recorder = createRecorder(callbackDispatchingMiddleware, configureSubscriptions(subStore), ...middleware);

    return { ...recorder, subStore };
}
