/* eslint-disable @typescript-eslint/ban-types */
import { DeltaTracker, RecordingDispatcher, createDeltaTracker, createRecordingDispatcher, DispatchContext, Next, getCallbacksAndUpdateSubscriptionsFromDeltas } from '@akutruff/dimmer';
import { createContext, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';

export const DeltaTrackerContext: React.Context<DeltaTrackerContextValue> = createContext(undefined as any as DeltaTrackerContextValue);

export interface DeltaTrackerContextProps {
    state: any;
    deltaTracker: DeltaTracker;
    dispatch: (state: any, ...args: any[]) => void;
}

export interface DeltaTrackerContextValue extends DeltaTrackerContextProps {
    recordingDispatcher: RecordingDispatcher
    mutableSources: WeakMap<object, any>;
    setContextProps: (props: Partial<DeltaTrackerContextProps>) => void;
}

export const createDeltaTrackerContextValue = (
    {
        state,
        deltaTracker = createDeltaTracker(),
        dispatch = ((_s, _a) => { })
    }: Partial<DeltaTrackerContextProps>,
    setContextProps: DeltaTrackerContextValue['setContextProps'] = (_props) => { })
    : DeltaTrackerContextValue => {

    const recordingDispatcher = createRecordingDispatcher(configureReactMiddleware(deltaTracker));

    const dispatchWrappedWithRecording = (state: any, ...args: any[]) => {
        return recordingDispatcher.mutate(dispatch, state, ...args);
    };

    return {
        state,
        deltaTracker,
        recordingDispatcher,
        dispatch: dispatchWrappedWithRecording,
        mutableSources: new WeakMap(),
        setContextProps
    };
};

//TODO: test what setContextProps.  Is it for simply changing any prop and causing a full re-render?
export const useDeltaTrackerContextValue = (initialValue: Partial<DeltaTrackerContextProps>): DeltaTrackerContextValue => {
    const [contextProps, setContextProps] = useState(initialValue);
    const value = useMemo(() => createDeltaTrackerContextValue(contextProps, setContextProps), [contextProps]);
    return value;
};

export const configureReactMiddleware = (deltaTracker: DeltaTracker) => (context: DispatchContext, next: Next) => {

    next();

    if (context.callstackDepth === 0) {
        const callbacksToFire = context.deltas ? getCallbacksAndUpdateSubscriptionsFromDeltas(deltaTracker, context.deltas) : undefined;
        //TODO: add history support externally
        //for consumers to do their own change tracking

        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        deltaTracker.version++;

        if (callbacksToFire && callbacksToFire.size > 0) {
            ReactDOM.unstable_batchedUpdates(() => {                
                for (const callback of callbacksToFire) {                
                    callback();
                }                
            });
        }
    }
};