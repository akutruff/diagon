/* eslint-disable @typescript-eslint/ban-types */
import { AnyArray } from './generics';
import { dimmerArrayProxyHandler } from './dimmerArray';
import { DimmerMap } from './dimmerMap';
import { objectProxyHandler } from './dimmerObject';
import { DimmerSet } from './dimmerSet';
import { Delta, DimmerContext, DimmerEnvironment, DimmerId, DIMMER_ID, ORIGINAL, InferDeltaType, Mutator } from './types';

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
export const objectToCurrentDelta = new WeakMap<any, Delta>();
export const deltaToTarget = new WeakMap<Delta, any>();

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

export function getCurrentDelta<T>(obj: T): InferDeltaType<T> | undefined {
    return objectToCurrentDelta.get(obj as any) as InferDeltaType<T> | undefined;
}

export function getDeltaTarget<T>(delta: InferDeltaType<T>): T | undefined {
    return deltaToTarget.get(delta) as T | undefined;
}

export function tryGetProxy<T>(obj: T): T | undefined {
    return objectToProxy.get(obj);
}

export function makeDeltaRecorder<TState extends object, TArgs extends AnyArray, R = unknown>(mutator: Mutator<TState, TArgs, R>) {
    return (state: TState, ...args: TArgs) => recordDeltas<TState, TArgs, R>(mutator, state, ...args);
}

export function recordDeltas<TState extends object, R>(mutator: (state: TState) => R, state: TState): Delta[];
export function recordDeltas<TState extends object, TArgs extends AnyArray, R>(mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs): Delta[];
export function recordDeltas<TState extends object, TArgs extends AnyArray, R>(mutator: Mutator<TState, TArgs, R> | ((state: TState) => R), state: TState, ...args: TArgs): Delta[] {
    try {
        createContext();
        const stateProxy = tryGetProxy(state) || createRecordingProxy(state);
        mutator(stateProxy, ...args);

        const changes = commitDeltas();
        return changes;
    }
    finally {
        clearContext();
    }
}

export function ensureProxy<TState extends object>(state: TState) {
    return tryGetProxy(state) || createRecordingProxy(state);
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

export function doNotTrack<T>(obj: T) : typeof obj{
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

export function commitDeltas(): Delta[] {
    const changes: Delta[] = [];

    for (const target of modified) {
        const targetProxy = objectToProxy.get(target);
        let delta;
        if (targetProxy instanceof DimmerMap || targetProxy instanceof DimmerSet) {
            delta = targetProxy.commitDelta();
        } else {
            //TODO: objects and arrays do the same thing, but if we wanted to do differencing of arrays we could do it here
            //      however it may best to convert arrays deltas to be Maps that record only what's changed in the proxy 
            //      rather than copying the whole thing.
            delta = objectToCurrentDelta.get(target)!;
            objectToCurrentDelta.delete(target);
        }
        changes.push(delta);
    }

    return changes;
}

