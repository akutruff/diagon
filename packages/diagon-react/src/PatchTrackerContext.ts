/* eslint-disable @typescript-eslint/ban-types */
import { PatchTracker, RecordingDispatcher, createPatchTracker, createRecordingDispatcher, DispatchContext, Next, getCallbacksAndUpdateSubscriptionsFromPatches, Patch, Middleware } from 'diagon';
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
    setContextProps: PatchTrackerContextValue['setContextProps'],
    ...middlewares: Middleware<DispatchContext>[])
    : PatchTrackerContextValue => {

    const recordingDispatcher = createRecordingDispatcher(configureReactMiddleware(patchTracker), ...middlewares);

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

export const usePatchTrackerContextValue = (initialValue: Partial<PatchTrackerContextProps>, ...middlewares: Middleware<DispatchContext>[]): PatchTrackerContextValue => {
    const [contextProps, setContextProps] = useState(initialValue);
    const value = useMemo(() => createPatchTrackerContextValue(contextProps, setContextProps, ...middlewares), [contextProps, ...middlewares]);
    return value;
};

export const configureReactMiddleware = (patchTracker: PatchTracker) => (context: DispatchContext, next: Next) => {

    next();

    if (context.pipelineStackDepth === 0) {
        //TODO: use Number.MAX_SAFE_INTEGER or BigInt
        patchTracker.version++;

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
            const callbacksToFire = getCallbacksAndUpdateSubscriptionsFromPatches(patchTracker, patches);

            //TODO: add history support externally
            //for consumers to do their own change tracking

            if (callbacksToFire.size > 0) {
                ReactDOM.unstable_batchedUpdates(() => {
                    for (const callback of callbacksToFire) {
                        callback();
                    }
                });
            }

            // if (callbacksToFire.size > 0 || patchTracker.onNewPatches.size > 0) {

            //     const onNewPatches = Array.from(patchTracker.onNewPatches.values());

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