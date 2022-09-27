/* eslint-disable @typescript-eslint/ban-types */
import { asOriginal, ChildSubscriberRecursive, Mutator, PatchHandler, SubscriptionStore, subscribe, subscribeDeep, subscribeRecursive, Subscription, unsubscribe, SubscribingRecorder } from 'diagon';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { StoreContext } from '.';

export const useStore = () => useContext(StoreContext);

export const useRootState = () => useStore().state;

export const getTypedUseRootState = <T>() => useRootState as () => T;

export type ReactHooks = ReturnType<typeof createRecorderHooks>;

export interface UseMutator {
    <TState extends object, TArgs extends unknown[], R>(state: TState, mutator: Mutator<TState, TArgs, R>, deps?: Array<unknown>): (...args: TArgs) => R,
}

export interface UseMutatorWithPatches {
    <TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R>(
        state: TState,
        mutator: Mutator<TState, TArgs, R>,
        patchHandlerState: TPatchHandlerState,
        patchHandler: PatchHandler<TPatchHandlerState, TState, TArgs, R>,
        deps?: Array<unknown>): (...args: TArgs) => R
}

export interface UseSnap {
    <TState extends object, TSnap>(state: TState, selector: (state: TState) => TSnap, deps?: Array<unknown>): TSnap
}

export interface UseProjectedSnap {
    <TState extends object, TSnap>(
        state: TState,
        subscriber: (state: TState) => any,
        selector: (state: TState, previousSnap?: TSnap) => TSnap,
        deps?: Array<any>): TSnap;
}

export interface UseSubsribedDeep {
    <TState extends object, TSnap>(
        state: TState,
        subscriber: (subStore: SubscriptionStore, state: TState, callback: () => void) => Subscription,
        selector: (state: TState, previousSnap?: TSnap) => TSnap,
        deps?: Array<unknown>)
        : TSnap;
}

export interface UseRecursiveSnap {
    <TState extends object, TChildState, TSnap>(
        state: TState,
        childSelector: (state: TState) => TChildState,
        subscribeToChildren: ChildSubscriberRecursive<TChildState>,
        selector: (state: TState, previousSnap?: TSnap) => TSnap,
        deps?: Array<unknown>)
        : TSnap
}

export interface UseDeepSnap {
    <TState extends object, TChildState, TSnap>(
        state: TState,
        childSelector: (state: TState) => TChildState,
        subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => Subscription,
        selector: (state: TState, previousSnap?: TSnap) => TSnap,
        deps?: Array<unknown>)
        : TSnap;
}

type MutatorArgs<T> = T extends Mutator<infer _TState, infer TArgs, infer _R> ? TArgs : never;

export const createRecorderHooks = (recorder: SubscribingRecorder) => {

    const useMutator: UseMutator = (state, mutator, deps = []) =>
        useCallback((...args) => recorder.mutate(state, mutator, ...args), [recorder, state, ...deps]);

    const useMutatorWithPatches: UseMutatorWithPatches = (state, mutator, patchHandlerState, patchHandler, deps = []) => {

        const patchHandlerCallback = useCallback(patchHandler, [recorder, state, patchHandlerState, ...deps]);
        const mutatorWithChangeTrackingAdded = useCallback((...args: MutatorArgs<typeof mutator>) =>
            recorder.mutateWithPatches(state, mutator, patchHandlerState, patchHandler, ...args),
            [recorder, patchHandlerCallback]);

        return mutatorWithChangeTrackingAdded;
    };

    const useSnap: UseSnap = (state, selector, deps = []) => {
        state = asOriginal(state);
        const { subStore } = recorder;

        const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);

        const sub = useCallback((tellReactToRerender: any) => {
            const subscriptions = subscribe(subStore, state, selector, tellReactToRerender);
            return () => unsubscribe(subscriptions);
        }, [subStore, getSnapCallback]);
        return useSyncExternalStore(sub, getSnapCallback);
    };

    const useProjectedSnap: UseProjectedSnap = (state, subscriber, selector, deps = []) => {
        state = asOriginal(state);
        const { subStore } = recorder;

        const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);

        const sub = useCallback((tellReactToRerender: any) => {
            const subscriptions = subscribe(subStore, state, subscriber, tellReactToRerender);
            return () => unsubscribe(subscriptions);
        }, [subStore, getSnapCallback, subscriber]); //TODO: subscriber will likely change every call! should only rely on deps?
        return useSyncExternalStore(sub, getSnapCallback);
    };

    const useSubscribedSnap: UseSubsribedDeep = (state, subscriber, selector, deps = []) => {
        state = asOriginal(state);
        const { subStore } = recorder;

        const getSnapCallback = useMemoizedSnapCallback(selector, state, subStore, deps);
        const subscriberCallback = useCallback(subscriber, []);

        const sub = useCallback((tellReactToRerender: any) => {
            const subscriptions = subscriber(subStore, state, tellReactToRerender);
            return () => unsubscribe(subscriptions);
        }, [subStore, getSnapCallback, subscriberCallback]);
        return useSyncExternalStore(sub, getSnapCallback);
    };

    const useRecursiveSnap: UseRecursiveSnap = (state, childSelector, subscribeToChildren, selector, deps = []) => {
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
    };

    const useDeepSnap: UseDeepSnap = (state, childSelector, subscribeToChildren, selector, deps = []) => {
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
    };

    return {
        useMutator,
        useMutatorWithPatches,
        useSnap,
        useProjectedSnap,
        useSubscribedSnap,
        useRecursiveSnap,
        useDeepSnap
    };
};


export const useMutator: UseMutator = (state, ...args) => useStore().recorder.useMutator(state, ...args);

export const useMutatorWithPatches: UseMutatorWithPatches = (state, ...args) => useStore().recorder.useMutatorWithPatches(state, ...args);

export const useSnap: UseSnap = (state, ...args) => useStore().recorder.useSnap(state, ...args);

export const useProjectedSnap: UseProjectedSnap = (state, ...args) => useStore().recorder.useProjectedSnap(state, ...args);

export const useSubscribedSnap: UseSubsribedDeep = (state, ...args) => useStore().recorder.useSubscribedSnap(state, ...args);

export const useRecursiveSnap: UseRecursiveSnap = (state, ...args) => useStore().recorder.useRecursiveSnap(state, ...args);

export const useDeepSnap: UseDeepSnap = (state, ...args) => useStore().recorder.useDeepSnap(state, ...args);

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
