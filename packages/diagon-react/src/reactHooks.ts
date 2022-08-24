/* eslint-disable @typescript-eslint/ban-types */
import { asOriginal, AsyncMutator, ChildSubscriberRecursive, Mutator, PatchHandler, SubscriptionStore, subscribe, subscribeDeep, subscribeRecursive, Subscription, unsubscribe } from 'diagon';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { StoreContext } from '.';

export const useStore = () => {
    return useContext(StoreContext);
};

export const useRootState = () => {
    const { state } = useStore();
    return state;
};

export const getTypedUseRootState = <T>() => {
    return useRootState as () => T;
}

export const useMutator = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recorder } = useStore();

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recorder.mutate(state, mutator, ...args), [recorder, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useMutatorWithPatches = <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
    state: TState,
    mutator: Mutator<TState, TArgs, R>,
    patchHandlerState: TPatchHandlerState,
    patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
    deps: Array<unknown> = []) => {
    const { recorder } = useStore();

    const patchHandlerCallback = useCallback(patchHandler, [recorder, state, patchHandlerState, ...deps]);
    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => {
        recorder.mutateWithPatches(state, mutator, patchHandlerState, patchHandler, ...args);
    }, [recorder, patchHandlerCallback]);

    return mutatorWithChangeTrackingAdded;
};

export const useMutatorAsync = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: AsyncMutator<TState, TArgs, R>, deps: Array<unknown> = []) => {
    const { recorder } = useStore();

    const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => recorder.mutateAsync(state, mutator, ...args), [recorder, state, ...deps]);

    return mutatorWithChangeTrackingAdded;
};

export const useSnapshot = <TState extends object, TSnapshot>(state: TState, selector: (state: TState) => TSnapshot, deps: Array<unknown> = []): TSnapshot => {
    state = asOriginal(state);
    const { subStore } = useStore().recorder;

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(subStore, selector), [subStore, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((tellReactToRerender: any) => {
        const subscriptions = subscribe(subStore, state, selector, tellReactToRerender);
        return () => unsubscribe(subscriptions);
    }, [subStore, getSnapshotCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

//Allows the subscription function to be different from the snapshot.  This is important if you want to calculate values in the getSnapshot function
//  and wish to return the previous value to prevent a re-render.
export const useProjectedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (state: TState) => any,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<any> = []): TSnapshot => {
    state = asOriginal(state);
    const { subStore } = useStore().recorder;

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(subStore, selector), [subStore, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);

    const sub = useCallback((tellReactToRerender: any) => {
        const subscriptions = subscribe(subStore, state, subscriber, tellReactToRerender);
        return () => unsubscribe(subscriptions);
    }, [subStore, getSnapshotCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useSubscribedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { subStore } = useStore().recorder;

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(subStore, selector), [subStore, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const subscriberCallback = useCallback(subscriber, []);

    const sub = useCallback((tellReactToRerender: any) => {
        const subscriptions = subscriber(subStore, state, tellReactToRerender);
        return () => unsubscribe(subscriptions);
    }, [subStore, getSnapshotCallback, subscriberCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useRecursiveSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { subStore } = useStore().recorder;

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(subStore, selector), [subStore, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((tellReactToRerender: any) => {
        const subscriptions = subscribeRecursive(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
        return () => unsubscribe(subscriptions);
    }, [subStore, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

export const useDeepSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot => {
    state = asOriginal(state);
    const { subStore } = useStore().recorder;

    const memoizeSnapshot = useMemo(() => createSnapshotMemoizer(subStore, selector), [subStore, state, ...deps]);
    const getSnapshotCallback = useCallback(() => memoizeSnapshot(state), [memoizeSnapshot]);
    const childSelectorCallback = useCallback(childSelector, []);
    const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
    const sub = useCallback((tellReactToRerender: any) => {
        const subscriptions = subscribeDeep(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
        return () => unsubscribe(subscriptions);
    }, [subStore, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);
    return useSyncExternalStore(sub, getSnapshotCallback);
};

function createSnapshotMemoizer<TState extends object, TSnapshot>(subStore: SubscriptionStore, getSnapshot: (state: TState, previousSnapshot?: TSnapshot | undefined) => TSnapshot) {
    let previousVersion: number | undefined = undefined;
    let currentSnapshot: TSnapshot | undefined = undefined;
    return (state: TState) => {
        if (previousVersion === undefined || previousVersion !== subStore.version) {
            currentSnapshot = getSnapshot(state, currentSnapshot);
            previousVersion = subStore.version;
        }
        return currentSnapshot as TSnapshot;
    };
}
