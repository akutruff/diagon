/* eslint-disable @typescript-eslint/ban-types */
import { SubscriptionStore, RecordingDispatcher, createSubscriptionStore, createRecordingDispatcher, DispatchContext, Next, getCallbacksAndUpdateSubscriptionsFromPatches, Patch, Middleware } from 'diagon';
import { createContext, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

export const SubscriptionContext: React.Context<SubscriptionContextValue> = createContext(undefined as any as SubscriptionContextValue);

export interface SubscriptionContextProps {
    state: any;
    subStore: SubscriptionStore;
    dispatch: (state: any, ...args: any[]) => void;
}

export interface SubscriptionContextValue extends SubscriptionContextProps {
    recordingDispatcher: RecordingDispatcher
    setContextProps: (props: Partial<SubscriptionContextProps>) => void;
}

export const createSubscriptionContextValue = (
    {
        state,
        subStore = createSubscriptionStore(),
        dispatch = ((_s, _a) => { })
    }: Partial<SubscriptionContextProps>,
    setContextProps: SubscriptionContextValue['setContextProps'],
    ...middlewares: Middleware<DispatchContext>[])
    : SubscriptionContextValue => {

    const recordingDispatcher = createRecordingDispatcher(configureReactMiddleware(subStore), ...middlewares);

    const dispatchWrappedWithRecording = (state: any, ...args: any[]) => {
        return recordingDispatcher.mutate(dispatch, state, ...args);
    };

    return {
        state,
        subStore,
        recordingDispatcher,
        dispatch: dispatchWrappedWithRecording,
        setContextProps
    };
};

export const useSubscriptionContextValue = (initialValue: Partial<SubscriptionContextProps>, ...middlewares: Middleware<DispatchContext>[]): SubscriptionContextValue => {
    const [contextProps, setContextProps] = useState(initialValue);
    const value = useMemo(() => createSubscriptionContextValue(contextProps, setContextProps, ...middlewares), [contextProps, ...middlewares]);
    return value;
};

export const configureReactMiddleware = (subStore: SubscriptionStore) => (context: DispatchContext, next: Next) => {

    next();

    if (context.pipelineStackDepth === 0) {
        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        subStore.version++;

        const patches: Patch[] = [];
        if (context.patches) {
            patches.push(...context.patches);
        }

        if (context.patchesFromPatchHandler) {
            patches.push(...context.patchesFromPatchHandler);
        }

        if (context.patchesFromGlobalPatchHandler) {
            patches.push(...context.patchesFromGlobalPatchHandler);
        }

        if (patches.length > 0) {
            const callbacksToFire = getCallbacksAndUpdateSubscriptionsFromPatches(subStore, patches);

            //TODO: add history support externally
            //for consumers to do their own change tracking

            if (callbacksToFire.size > 0) {
                ReactDOM.unstable_batchedUpdates(() => {
                    for (const callback of callbacksToFire) {
                        callback();
                    }
                });
            }

            // if (callbacksToFire.size > 0 || subStore.onNewPatches.size > 0) {

            //     const onNewPatches = Array.from(subStore.onNewPatches.values());

            //     ReactDOM.unstable_batchedUpdates(() => {
            //         for (const callback of callbacksToFire) {
            //             callback();
            //         }

            //         for (const onNewPatchesCallback of onNewPatches) {
            //             onNewPatchesCallback(patches);
            //         }
            //     });
            // }
        }
    }
};