/* eslint-disable @typescript-eslint/ban-types */
import { AnyArray } from './generics';
import { dimmerArrayProxyHandler } from './dimmerArray';
import { DimmerMap } from './dimmerMap';
import { objectProxyHandler } from './dimmerObject';
import { DimmerSet } from './dimmerSet';
import { Patch, DimmerContext, DimmerEnvironment, DimmerId, DIMMER_ID, ORIGINAL, InferPatchType, Mutator } from './types';

export const Dimmer: DimmerEnvironment = { nextId: 0 };
export const modified = new Set<any>();

// let modified = () => {};
// let proxier = () => {};

export function resetEnvironment() {
    Dimmer.nextId = 0;
    Dimmer.currentContext = undefined;
    modified.clear();
}

export const objectToProxy = new WeakMap<any, any>();
export const objectToCurrentPatch = new WeakMap<any, Patch>();
export const patchToTarget = new WeakMap<Patch, any>();

export function currentContext(): DimmerContext | undefined {
    return Dimmer.currentContext;
}

export function createContext() {
    // if (Dimmer.currentContext !== undefined) {
    //     throw new Error('Dimmer context already created');
    // }
    modified.clear();
    // Dimmer.currentContext = {
    //     modified: new Set()
    // };
}

export function clearContext() {
    //Dimmer.currentContext = undefined;
    modified.clear();
}

export function isProxy(obj: any): boolean {
    return !!obj[ORIGINAL];
}

export function asOriginal<T>(obj: T): T {
    return (obj && (obj as any)[ORIGINAL]) || obj;
}

export function getCurrentPatch<T>(obj: T): InferPatchType<T> | undefined {
    return objectToCurrentPatch.get(obj as any) as InferPatchType<T> | undefined;
}

export function getPatchTarget<T>(patch: InferPatchType<T>): T | undefined {
    return patchToTarget.get(patch) as T | undefined;
}

export function tryGetProxy<T>(obj: T): T | undefined {
    return objectToProxy.get(obj);
}

export function areSame(one: any, two: any): boolean {
    return asOriginal(one) === asOriginal(two);
}

export function makePatchRecorder<TState extends object, TArgs extends AnyArray, R = unknown>(mutator: Mutator<TState, TArgs, R>) {
    return (state: TState, ...args: TArgs) => recordPatches<TState, TArgs, R>(mutator, state, ...args);
}

export function recordPatches<TState extends object, R>(mutator: (state: TState) => R, state: TState): Patch[];
export function recordPatches<TState extends object, TArgs extends AnyArray, R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs): Patch[];
export function recordPatches<TState extends object, TArgs extends AnyArray, R>(mutator: Mutator<TState, TArgs, R> | ((state: TState) => R), state: TState, ...args: TArgs): Patch[] {
    try {
        createContext();
        const stateProxy = tryGetProxy(state) || createRecordingProxy(state);
        mutator(stateProxy, ...args);

        const changes = commitPatches();
        return changes;
    }
    finally {
        clearContext();
    }
}

export function ensureProxy<T extends object>(obj: T): T {
    return tryGetProxy(obj) || createRecordingProxy(obj);
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function createRecordingProxy<T extends object>(target: T): T {
    if (isProxy(target)) {
        throw new Error('trying to proxy a proxy');
    }
    let proxy;
    if (target instanceof Map) {
        proxy = new DimmerMap<any, any>(target) as T;
    } else if (target instanceof Set) {
        proxy = new DimmerSet<any>(target) as T;
    } else if (Array.isArray(target)) {
        proxy = new Proxy<T>(target, dimmerArrayProxyHandler);
    } else {
        proxy = new Proxy<T>(target, objectProxyHandler);
    }
    objectToProxy.set(target, proxy);
    objectToProxy.set(proxy, proxy);

    return proxy as T;
}

export function doNotTrack<T>(obj: T): typeof obj {
    if (obj) {
        objectToProxy.set(obj, obj);
    }
    return obj;
}

export function proxify(value: any) {
    return objectToProxy.get(value) || (
        typeof value !== 'object' || !value
            ? value
            : createRecordingProxy(value));
}

function allocateDimmerId(): DimmerId {
    return Dimmer.nextId++;
}

//TODO: deprectated
export function assignDimmerId(target: any) {
    const id = allocateDimmerId();
    Object.defineProperty(target, DIMMER_ID, { value: id, configurable: true, writable: true, enumerable: false });
    return id;
}

export function commitPatches(): Patch[] {
    const changes: Patch[] = [];

    for (const target of modified) {
        const targetProxy = objectToProxy.get(target);

        let patch;
        if (targetProxy instanceof DimmerMap || targetProxy instanceof DimmerSet) {
            patch = targetProxy.commitPatch();
        } else {
            //TODO: objects and arrays do the same thing, but if we wanted to do differencing of arrays we could do it here
            //      however it may best to convert arrays patches to be Maps that record only what's changed in the proxy 
            //      rather than copying the whole thing.
            patch = objectToCurrentPatch.get(target)!;
            objectToCurrentPatch.delete(target);
        }
        changes.push(patch);
    }

    return changes;
}

