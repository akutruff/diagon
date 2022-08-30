/* eslint-disable @typescript-eslint/ban-types */
import { asOriginal, AsyncMutator, ChildSubscriberRecursive, Mutator, PatchHandler, SubscriptionStore, subscribe, subscribeDeep, subscribeRecursive, Subscription, unsubscribe, SubscribingRecorder } from 'diagon';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { StoreContext } from '.';

export const useStore = () => useContext(StoreContext);

export const useRootState = () => useStore().state;

export const getTypedUseRootState = <T>() => useRootState as () => T;

export type ReactHooks = ReturnType<typeof createRecorderHooks>;

export const createRecorderHooks = (recorder: SubscribingRecorder) => {
    return {
        useMutator: <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps: Array<unknown> = []) =>
            useCallback((...args: TArgs) => recorder.mutate(state, mutator, ...args), [recorder, state, ...deps]),

        useMutatorWithPatches: <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
            state: TState,
            mutator: Mutator<TState, TArgs, R>,
            patchHandlerState: TPatchHandlerState,
            patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
            deps: Array<unknown> = []) => {

            const patchHandlerCallback = useCallback(patchHandler, [recorder, state, patchHandlerState, ...deps]);
            const mutatorWithChangeTrackingAdded = useCallback((...args: TArgs) => {
                recorder.mutateWithPatches(state, mutator, patchHandlerState, patchHandler, ...args);
            }, [recorder, patchHandlerCallback]);

            return mutatorWithChangeTrackingAdded;
        },

        useMutatorAsync: <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: AsyncMutator<TState, TArgs, R>, deps: Array<unknown> = []) =>
            useCallback((...args: TArgs) => recorder.mutateAsync(state, mutator, ...args), [recorder, state, ...deps]),

        useSnapshot: <TState extends object, TSnapshot>(state: TState, selector: (state: TState) => TSnapshot, deps: Array<unknown> = []): TSnapshot => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapshotCallback = useMemoizedSnapshotCallback(selector, state, subStore, deps);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribe(subStore, state, selector, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapshotCallback]);
            return useSyncExternalStore(sub, getSnapshotCallback);
        },

        //Allows the subscription function to be different from the snapshot.  This is important if you want to calculate values in the getSnapshot function
        //  and wish to return the previous value to prevent a re-render.
        useProjectedSnapshot: <TState extends object, TSnapshot>(
            state: TState,
            subscriber: (state: TState) => any,
            selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
            deps: Array<any> = []): TSnapshot => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapshotCallback = useMemoizedSnapshotCallback(selector, state, subStore, deps);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribe(subStore, state, subscriber, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapshotCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
            return useSyncExternalStore(sub, getSnapshotCallback);
        },

        useSubscribedSnapshot: <TState extends object, TSnapshot>(
            state: TState,
            subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
            selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
            deps: Array<unknown> = [])
            : TSnapshot => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapshotCallback = useMemoizedSnapshotCallback(selector, state, subStore, deps);
            const subscriberCallback = useCallback(subscriber, []);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscriber(subStore, state, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapshotCallback, subscriberCallback]);

            return useSyncExternalStore(sub, getSnapshotCallback);
        },

        useRecursiveSnapshot: <TState extends object, TChildState, TSnapshot>(
            state: TState,
            childSelector: (state: TState) => TChildState,
            subscribeToChildren: ChildSubscriberRecursive<TChildState>,
            selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
            deps: Array<unknown> = [])
            : TSnapshot => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapshotCallback = useMemoizedSnapshotCallback(selector, state, subStore, deps);
            const childSelectorCallback = useCallback(childSelector, []);
            const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribeRecursive(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);

            return useSyncExternalStore(sub, getSnapshotCallback);
        },

        useDeepSnapshot: <TState extends object, TChildState, TSnapshot>(
            state: TState,
            childSelector: (state: TState) => TChildState,
            subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
            selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
            deps: Array<unknown> = [])
            : TSnapshot => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapshotCallback = useMemoizedSnapshotCallback(selector, state, subStore, deps);
            const childSelectorCallback = useCallback(childSelector, []);
            const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribeDeep(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapshotCallback, childSelectorCallback, subscribeToChildrenCallback]);

            return useSyncExternalStore(sub, getSnapshotCallback);
        }
    };
};

export const useMutator = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps: Array<unknown> = []) =>
    useStore().recorder.useMutator(state, mutator, deps);

export const useMutatorWithPatches = <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
    state: TState,
    mutator: Mutator<TState, TArgs, R>,
    patchHandlerState: TPatchHandlerState,
    patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
    deps: Array<unknown> = []) =>
    useStore().recorder.useMutatorWithPatches(state, mutator, patchHandlerState, patchHandler, deps);

export const useMutatorAsync = <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: AsyncMutator<TState, TArgs, R>, deps: Array<unknown> = []) =>
    useStore().recorder.useMutatorAsync(state, mutator, deps);

export const useSnapshot = <TState extends object, TSnapshot>(state: TState, selector: (state: TState) => TSnapshot, deps: Array<unknown> = []): TSnapshot =>
    useStore().recorder.useSnapshot(state, selector, deps);

//Allows the subscription function to be different from the snapshot.  This is important if you want to calculate values in the getSnapshot function
//  and wish to return the previous value to prevent a re-render.
export const useProjectedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (state: TState) => any,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<any> = []): TSnapshot =>
    useStore().recorder.useProjectedSnapshot(state, subscriber, selector, deps);

export const useSubscribedSnapshot = <TState extends object, TSnapshot>(
    state: TState,
    subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot =>
    useStore().recorder.useSubscribedSnapshot(state, subscriber, selector, deps);

export const useRecursiveSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot =>
    useStore().recorder.useRecursiveSnapshot(state, childSelector, subscribeToChildren, selector, deps);

export const useDeepSnapshot = <TState extends object, TChildState, TSnapshot>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnapshot?: TSnapshot) => TSnapshot,
    deps: Array<unknown> = [])
    : TSnapshot =>
    useStore().recorder.useDeepSnapshot(state, childSelector, subscribeToChildren, selector, deps);

function useMemoizedSnapshotCallback<TState extends object, TSnapshot>(
    getSnapshot: (state: TState, previousSnapshot?: TSnapshot | undefined) => TSnapshot,
    state: TState,
    subStore: SubscriptionStore,
    deps: Array<unknown> = []) {
    return useMemo(() => {
        let previousVersion: number | undefined = undefined;
        let currentSnapshot: TSnapshot | undefined = undefined;
        return () => {
            if (previousVersion === undefined || previousVersion !== subStore.version) {
                currentSnapshot = getSnapshot(state, currentSnapshot);
                previousVersion = subStore.version;
            }
            return currentSnapshot as TSnapshot;
        };
    }, [subStore, state, ...deps]);
}
