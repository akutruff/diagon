/* eslint-disable @typescript-eslint/ban-types */
import { Mutator, AsyncMutator, asOriginal, subscribe, unsubscribe, PatchTracker, Subscription, subscribeDeep, ChildSubscriberRecursive, subscribeRecursive } from 'diagon';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { PatchTrackerContext } from '.';


export const useRootState = () => {
    const { state } = useContext(PatchTrackerContext);
    return state;
};

export const useDispatch = () => {
    const { dispatch, state } = useContext(PatchTrackerContext);
    const dispatchCallback = useCallback((args: any) => dispatch(state, args), [state, dispatch]);
    return dispatchCallback;
};

export const useMutator = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recordingDispatcher } = useContext(PatchTrackerContext);

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recordingDispatcher.mutate(mutator, state, ...args), [recordingDispatcher, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useMutatorAsync = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: AsyncMutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recordingDispatcher } = useContext(PatchTrackerContext);

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recordingDispatcher.mutateAsync(mutator, state, ...args), [recordingDispatcher, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useSnapshot = <TState extends object, TSnapshot>(state: TState, getSnapshot: (state: TState) => TSnapshot, deps: Array<unknown> = []): TSnapshot => {
    state = asOriginal(state);
    const { patchTracker } = useContext(PatchTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(patchTracker, getSnapshot), [patchTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscribe(patchTracker, state, getSnapshot, listener);
        return () => unsubscribe(subscriptions);
    }, [patchTracker, getSnapshotCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

//Allows the subscription function to be different from the snapshot.  This is important if you want to calculate values in the getSnapshot function
//  and wish to return the previous value to prevent a re-render.
export const useProjectedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (state: TState) => any,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<any> = []): TSnapshot => {
    state = asOriginal(state);
    const { patchTracker } = useContext(PatchTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(patchTracker, getSnapshot), [patchTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscribe(patchTracker, state, subscriber, listener);
        return () => unsubscribe(subscriptions);
    }, [patchTracker, getSnapshotCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useSubscribedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (patchTracker: PatchTracker, state: TState, callback: () => void) => Subscription,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { patchTracker } = useContext(PatchTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(patchTracker, getSnapshot), [patchTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const subscriberCallback = useCallback(subscriber, []);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscriber(patchTracker, state, listener);
        return () => unsubscribe(subscriptions);
    }, [patchTracker, getSnapshotCallback, subscriberCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useRecursiveSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { patchTracker } = useContext(PatchTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(patchTracker, getSnapshot), [patchTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((listener: any) => {
        const subscriptions = subscribeRecursive(patchTracker, state, childSelector, subscribeToChildren, listener);
        return () => unsubscribe(subscriptions);
    }, [patchTracker, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useDeepSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: (patchTracker: PatchTracker, selectedChild: TChildState, callback: () => void) => Subscription,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { patchTracker } = useContext(PatchTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(patchTracker, getSnapshot), [patchTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((listener: any) => {
        const subscriptions = subscribeDeep(patchTracker, state, childSelector, subscribeToChildren, listener);
        return () => unsubscribe(subscriptions);
    }, [patchTracker, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

function createSnapshotMemoizer<TState extends object, TSnapshot>(patchTracker: PatchTracker, getSnapshot: (state: TState, previousSnapshot?: TSnapshot | undefined) => TSnapshot) {
    let previousVersion: number | undefined = undefined;
    let currentSnapshot: TSnapshot | undefined = undefined;
    return (state: TState) => {
        if (previousVersion === undefined || previousVersion !== patchTracker.version) {
            currentSnapshot = getSnapshot(state, currentSnapshot);
            previousVersion = patchTracker.version;
        }
        return currentSnapshot as TSnapshot;
    };
}
