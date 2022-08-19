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
    //TODO: verify that useMemo is okay instead of useState, since useMemo may not be guaranteed to cache.
    const value = useMemo(() => createSubscriptionContextValue(contextProps, setContextProps, ...middlewares), [contextProps, ...middlewares]);
    return value;
};

export const configureReactMiddleware = (subStore: SubscriptionStore) => (context: DispatchContext, next: Next) => {

    next();

    if (context.pipelineStackDepth === 0) {
        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        subStore.version++;

        const allPatches = context.allPatchSetsFromPipeline.flat();
        if (allPatches.length > 0) {
            const callbacksToFire = getCallbacksAndUpdateSubscriptionsFromPatches(subStore, allPatches);

            //TODO: add history support externally
            //for consumers to do their own change tracking

            if (callbacksToFire.size > 0) {
                ReactDOM.unstable_batchedUpdates(() => {
                    for (const callback of callbacksToFire) {
                        callback();
                    }
                });
            }
        }
    }
};