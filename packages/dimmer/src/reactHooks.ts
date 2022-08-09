/* eslint-disable @typescript-eslint/ban-types */
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { subscribe, subscribeDeep, Subscription, DeltaTracker, DeltaTrackerContext, Mutator, asOriginal, AsyncMutator, } from '.';
import { ChildSubscriberRecursive, subscribeRecursive, unsubscribe } from './subscriptions';

export const useRootState = () => {
    const { state } = useContext(DeltaTrackerContext);
    return state;
};

export const useDispatch = () => {
    const { dispatch, state } = useContext(DeltaTrackerContext);
    const dispatchCallback = useCallback((args: any) => dispatch(state, args), [state, dispatch]);
    return dispatchCallback;
};

export const useMutator = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recordingDispatcher } = useContext(DeltaTrackerContext);

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recordingDispatcher.mutate(mutator, state, ...args), [recordingDispatcher, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useMutatorAsync = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: AsyncMutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recordingDispatcher } = useContext(DeltaTrackerContext);

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recordingDispatcher.mutateAsync(mutator, state, ...args), [recordingDispatcher, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useSnapshot = <TState extends object, TSnapshot>(state: TState, getSnapshot: (state: TState) => TSnapshot, deps: Array<unknown> = []): TSnapshot => {
    state = asOriginal(state);
    const { deltaTracker } = useContext(DeltaTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(deltaTracker, getSnapshot), [deltaTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscribe(deltaTracker, state, getSnapshot, listener);
        return () => unsubscribe(subscriptions);
    }, [deltaTracker, getSnapshotCallback]);
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
    const { deltaTracker } = useContext(DeltaTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(deltaTracker, getSnapshot), [deltaTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscribe(deltaTracker, state, subscriber, listener);
        return () => unsubscribe(subscriptions);
    }, [deltaTracker, getSnapshotCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useSubscribedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (deltaTracker: DeltaTracker, state: TState, callback: () => void) => Subscription,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { deltaTracker } = useContext(DeltaTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(deltaTracker, getSnapshot), [deltaTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const subscriberCallback = useCallback(subscriber, []);

    const sub = useCallback((listener: any) => {
        const subscriptions = subscriber(deltaTracker, state, listener);
        return () => unsubscribe(subscriptions);
    }, [deltaTracker, getSnapshotCallback, subscriberCallback]);
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
    const { deltaTracker } = useContext(DeltaTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(deltaTracker, getSnapshot), [deltaTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((listener: any) => {
        const subscriptions = subscribeRecursive(deltaTracker, state, childSelector, subscribeToChildren, listener);
        return () => unsubscribe(subscriptions);
    }, [deltaTracker, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useDeepSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: (deltaTracker: DeltaTracker, selectedChild: TChildState, callback: () => void) => Subscription,
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { deltaTracker } = useContext(DeltaTrackerContext);

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(deltaTracker, getSnapshot), [deltaTracker, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((listener: any) => {
        const subscriptions = subscribeDeep(deltaTracker, state, childSelector, subscribeToChildren, listener);
        return () => unsubscribe(subscriptions);
    }, [deltaTracker, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

function createSnapshotMemoizer<TState extends object, TSnapshot>(deltaTracker: DeltaTracker, getSnapshot: (state: TState, previousSnapshot?: TSnapshot | undefined) => TSnapshot) {
    let previousVersion: number | undefined = undefined;
    let currentSnapshot: TSnapshot | undefined = undefined;
    return (state: TState) => {
        if (previousVersion === undefined || previousVersion !== deltaTracker.version) {
            currentSnapshot = getSnapshot(state, currentSnapshot);
            previousVersion = deltaTracker.version;
        }
        return currentSnapshot as TSnapshot;
    };
}
