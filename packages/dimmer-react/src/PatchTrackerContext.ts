/* eslint-disable @typescript-eslint/ban-types */
import { PatchTracker, RecordingDispatcher, createPatchTracker, createRecordingDispatcher, DispatchContext, Next, getCallbacksAndUpdateSubscriptionsFromPatches } from '@akutruff/dimmer';
import { createContext, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

export const PatchTrackerContext: React.Context<PatchTrackerContextValue> = createContext(undefined as any as PatchTrackerContextValue);

export interface PatchTrackerContextProps {
    state: any;
    patchTracker: PatchTracker;
    dispatch: (state: any, ...args: any[]) => void;
}

export interface PatchTrackerContextValue extends PatchTrackerContextProps {
    recordingDispatcher: RecordingDispatcher
    mutableSources: WeakMap<object, any>;
    setContextProps: (props: Partial<PatchTrackerContextProps>) => void;
}

export const createPatchTrackerContextValue = (
    {
        state,
        patchTracker = createPatchTracker(),
        dispatch = ((_s, _a) => { })
    }: Partial<PatchTrackerContextProps>,
    setContextProps: PatchTrackerContextValue['setContextProps'] = (_props) => { })
    : PatchTrackerContextValue => {

    const recordingDispatcher = createRecordingDispatcher(configureReactMiddleware(patchTracker));

    const dispatchWrappedWithRecording = (state: any, ...args: any[]) => {
        return recordingDispatcher.mutate(dispatch, state, ...args);
    };

    return {
        state,
        patchTracker,
        recordingDispatcher,
        dispatch: dispatchWrappedWithRecording,
        mutableSources: new WeakMap(),
        setContextProps
    };
};

//TODO: test what setContextProps.  Is it for simply changing any prop and causing a full re-render?
export const usePatchTrackerContextValue = (initialValue: Partial<PatchTrackerContextProps>): PatchTrackerContextValue => {
    const [contextProps, setContextProps] = useState(initialValue);
    const value = useMemo(() => createPatchTrackerContextValue(contextProps, setContextProps), [contextProps]);
    return value;
};

export const configureReactMiddleware = (patchTracker: PatchTracker) => (context: DispatchContext, next: Next) => {

    next();

    if (context.callstackDepth === 0) {
        const callbacksToFire = context.patches ? getCallbacksAndUpdateSubscriptionsFromPatches(patchTracker, context.patches) : undefined;
        //TODO: add history support externally
        //for consumers to do their own change tracking

        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        patchTracker.version++;

        if (callbacksToFire && callbacksToFire.size > 0) {
            ReactDOM.unstable_batchedUpdates(() => {
                for (const callback of callbacksToFire) {
                    callback();
                }
            });
        }
    }
};