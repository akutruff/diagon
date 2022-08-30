/* eslint-disable @typescript-eslint/ban-types */
import { asOriginal, ChildSubscriberRecursive, Mutator, PatchHandler, SubscriptionStore, subscribe, subscribeDeep, subscribeRecursive, Subscription, unsubscribe, SubscribingRecorder } from 'diagon';
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

        useSnap: <TState extends object, TSnap>(state: TState, selector: (state: TState) => TSnap, deps: Array<unknown> = []): TSnap => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribe(subStore, state, selector, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapCallback]);
            return useSyncExternalStore(sub, getSnapCallback);
        },

        //Allows the subscription function to be different from the snap.  This is important if you want to calculate values in the getSnap function
        //  and wish to return the previous value to prevent a re-render.
        useProjectedSnap: <TState extends object, TSnap>(
            state: TState,
            subscriber: (state: TState) => any,
            selector: (state: TState, previousSnap?: TSnap) => TSnap,
            deps: Array<any> = []): TSnap => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribe(subStore, state, subscriber, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
            return useSyncExternalStore(sub, getSnapCallback);
        },

        useSubscribedSnap: <TState extends object, TSnap>(
            state: TState,
            subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
            selector: (state: TState, previousSnap?: TSnap) => TSnap,
            deps: Array<unknown> = [])
            : TSnap => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);
            const subscriberCallback = useCallback(subscriber, []);

            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscriber(subStore, state, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapCallback, subscriberCallback]);

            return useSyncExternalStore(sub, getSnapCallback);
        },

        useRecursiveSnap: <TState extends object, TChildState, TSnap>(
            state: TState,
            childSelector: (state: TState) => TChildState,
            subscribeToChildren: ChildSubscriberRecursive<TChildState>,
            selector: (state: TState, previousSnap?: TSnap) => TSnap,
            deps: Array<unknown> = [])
            : TSnap => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);
            const childSelectorCallback = useCallback(childSelector, []);
            const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribeRecursive(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapCallback, childSelectorCallback, subscribeToChildrenCallback]);

            return useSyncExternalStore(sub, getSnapCallback);
        },

        useDeepSnap: <TState extends object, TChildState, TSnap>(
            state: TState,
            childSelector: (state: TState) => TChildState,
            subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
            selector: (state: TState, previousSnap?: TSnap) => TSnap,
            deps: Array<unknown> = [])
            : TSnap => {
            state = asOriginal(state);
            const { subStore } = recorder;

            const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);
            const childSelectorCallback = useCallback(childSelector, []);
            const subscribeToChildrenCallback = useCallback(subscribeToChildren, []);
            const sub = useCallback((tellReactToRerender: any) => {
                const subscriptions = subscribeDeep(subStore, state, childSelector, subscribeToChildren, tellReactToRerender);
                return () => unsubscribe(subscriptions);
            }, [subStore, getSnapCallback, childSelectorCallback, subscribeToChildrenCallback]);

            return useSyncExternalStore(sub, getSnapCallback);
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

export const useSnap = <TState extends object, TSnap>(state: TState, selector: (state: TState) => TSnap, deps: Array<unknown> = []): TSnap =>
    useStore().recorder.useSnap(state, selector, deps);

//Allows the subscription function to be different from the snap.  This is important if you want to calculate values in the getSnap function
//  and wish to return the previous value to prevent a re-render.
export const useProjectedSnap = <TState extends object, TSnap>(
    state: TState,
    subscriber: (state: TState) => any,
    selector: (state: TState, previousSnap?: TSnap) => TSnap,
    deps: Array<any> = []): TSnap =>
    useStore().recorder.useProjectedSnap(state, subscriber, selector, deps);

export const useSubscribedSnap = <TState extends object, TSnap>(
    state: TState,
    subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnap?: TSnap) => TSnap,
    deps: Array<unknown> = [])
    : TSnap =>
    useStore().recorder.useSubscribedSnap(state, subscriber, selector, deps);

export const useRecursiveSnap = <TState extends object, TChildState, TSnap>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    selector: (state: TState, previousSnap?: TSnap) => TSnap,
    deps: Array<unknown> = [])
    : TSnap =>
    useStore().recorder.useRecursiveSnap(state, childSelector, subscribeToChildren, selector, deps);

export const useDeepSnap = <TState extends object, TChildState, TSnap>(
    state: TState,
    childSelector: (state: TState) => TChildState,
    subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
    selector: (state: TState, previousSnap?: TSnap) => TSnap,
    deps: Array<unknown> = [])
    : TSnap =>
    useStore().recorder.useDeepSnap(state, childSelector, subscribeToChildren, selector, deps);

function useMemoizedSnapCallback<TState extends object, TSnap>(
    getSnap: (state: TState, previousSnap?: TSnap | undefined) => TSnap,
    state: TState,
    subStore: SubscriptionStore,
    deps: Array<unknown> = []) {
    return useMemo(() => {
        let previousVersion: number | undefined = undefined;
        let currentSnap: TSnap | undefined = undefined;
        return () => {
            if (previousVersion === undefined || previousVersion !== subStore.version) {
                currentSnap = getSnap(state, currentSnap);
                previousVersion = subStore.version;
            }
            return currentSnap as TSnap;
        };
    }, [subStore, state, ...deps]);
}
