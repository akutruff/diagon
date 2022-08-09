import { assignDimmerId, asOriginal, deltaToTarget } from './dimmer';
import { createArrayDelta } from './dimmerArray';
import { createMapDelta, getKeyUsedByMap } from './dimmerMap';
import { createObjectDelta } from './dimmerObject';
import { createSetDelta } from './dimmerSet';

import { Delta, DIMMER_ID, ORIGINAL, InferDeltaType, NO_ENTRY, SetDelta, ArrayDelta, MapDelta, ObjectDelta, HistoryIndex, DimmeredObject } from './types';
import { isMap, isPlainObject, isSet } from './utils';

export function undoDelta(delta: Delta) {
    const target = deltaToTarget.get(delta);

    if (target instanceof Map) {
        const mapDelta = delta as MapDelta;
        for (const [key, value] of mapDelta) {
            const wasPreviouslyInMap = value !== NO_ENTRY;

            const targetKey = getKeyUsedByMap(target, key);

            if (wasPreviouslyInMap) {
                if (targetKey !== undefined && (key !== targetKey)) {
                    target.delete(targetKey);
                }
                target.set(key, value);
            } else {
                target.delete(key);
            }
        }
    } else if (target instanceof Set) {
        const setDelta = delta as SetDelta;

        for (const [key, wasPreviouslyInSet] of setDelta) {
            if (wasPreviouslyInSet) {
                target.add(key);
            } else {
                target.delete(key);
            }
        }
    } else if (Array.isArray(target)) {
        const arrayDelta = delta as ArrayDelta;
        target.length = arrayDelta.length;

        for (let i = 0; i < arrayDelta.length; i++) {
            target[i] = arrayDelta[i];
        }
    } else {
        //TODO: decide if an object's "own properties" will be modified because we're using undefined.  We could switch to NO_ENTRY
        //Object.assign(target, delta);
        for (const [key, value] of (delta as ObjectDelta)) {
            target[key] = value;
        }
    }
}

export function createReverseDelta(delta: Delta) {
    const target = deltaToTarget.get(delta);
    if (target instanceof Map) {
        const patch = createMapDelta(target);
        const mapDelta = delta as MapDelta;

        for (const key of mapDelta.keys()) {
            if (!target.has(key)) {
                patch.set(key, NO_ENTRY);
            } else {
                patch.set(key, target.get(key));
            }
        }
        return patch;
    } else if (target instanceof Set) {
        const patch = createSetDelta(target);
        const setDelta = delta as SetDelta;

        for (const key of setDelta.keys()) {
            const wasObjectRemovedInTarget = target.has(key);
            patch.set(key, wasObjectRemovedInTarget);
        }
        return patch;
    } else if (Array.isArray(target)) {
        const targetArray = target as unknown[];

        const patch = createArrayDelta(target as unknown[]);
        patch.length = targetArray.length;

        for (let i = 0; i < targetArray.length; i++) {
            patch[i] = targetArray[i];
        }

        return patch;
    } else {
        const patch: ObjectDelta<any> = createObjectDelta(target);

        // const deltaKeys = Object.keys(delta);

        for (const key of delta.keys()) {
            patch.set(key as any, (target as any)[(key as any)]);
            // (patch as any)[key] = (target as any)[key];
        }

        return patch;
    }
}

export function convertObjectReferencesToDimmerIdReferences(obj: any) {
    let result: typeof obj;
    for (const propertyKey of Object.keys(obj)) {
        const propertyValue = obj[propertyKey];

        const dimmerId = propertyValue[DIMMER_ID];
        if (dimmerId) {
            if (!result) {
                result = { ...obj };
            }
            result[propertyKey] = dimmerId;
        }
    }

    return result || obj;
}

export function getObjectTimeline<T>(history: Delta[][], objectToFind: T): HistoryIndex<InferDeltaType<T>>[] {
    const original = asOriginal(objectToFind);

    const timeline = history.map((deltas, index): HistoryIndex<InferDeltaType<T>> | undefined => {
        const deltaForOriginal = findDeltaForObject(deltas, original);
        return deltaForOriginal ? [index, deltaForOriginal] : undefined;
    }).filter((x): x is HistoryIndex<InferDeltaType<T>> => x !== undefined);

    return timeline;
}

export function findDeltaForObject<T>(deltas: Delta[], objectToFind: T): InferDeltaType<T> | undefined {
    const objTarget = asOriginal(objectToFind);

    const deltaForTarget = deltas.find(x => deltaToTarget.get(x) === objTarget);
    return deltaForTarget as InferDeltaType<T> | undefined;
}

export function findAllDeltasInHistory<T>(history: Delta[][], objectToFind: T): InferDeltaType<T>[] {
    const objTarget = asOriginal(objectToFind);
    const deltasInHistory = history.flat().filter((x): x is InferDeltaType<T> => deltaToTarget.get(x) === objTarget);

    return deltasInHistory;
}

export function cloneDeep<T>(value: T, clones: WeakMap<any, any> = new WeakMap()): T {
    if (typeof value !== 'object') {
        return value;
    }
    const valueAsAny = value as any;

    let clone = clones.get(value);
    if (clone) {
        return clone;
    }

    const proxyOriginal = valueAsAny[ORIGINAL];
    if (proxyOriginal) {
        return cloneDeep(proxyOriginal, clones);
    }

    const dimmeredValue = value as any as DimmeredObject;
    if (dimmeredValue[DIMMER_ID] === undefined) {
        assignDimmerId(value);
    }

    if (Array.isArray(value)) {
        clone = [];
        clones.set(value, clone);
        clone.length = value.length;
        for (let i = 0; i < value.length; i++) {
            clone[i] = cloneDeep(value[i], clones);
        }
    } else if (isMap(value)) {
        clone = new Map();
        clones.set(value, clone);
        for (const [entryKey, entryValue] of value) {
            clone.set(cloneDeep(entryKey, clones), cloneDeep(entryValue, clones));
        }
    } else if (isSet(value)) {
        clone = new Set();
        clones.set(value, clone);

        for (const entryValue of value) {
            clone.add(cloneDeep(entryValue, clones));
        }
    } else if (isPlainObject(value)) {
        clone = {};
        clones.set(value, clone);

        for (const propertyKey of Object.keys(value)) {
            clone[propertyKey] = cloneDeep(valueAsAny[propertyKey], clones);
        }
    }
    else {
        throw new Error('unexpected type');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dimmerIdPropertyDescriptor = Object.getOwnPropertyDescriptor(value, DIMMER_ID)!;
    Object.defineProperty(clone, DIMMER_ID, dimmerIdPropertyDescriptor);

    return clone;
}

export function removeDimmerMetadata<T>(value: T, visited: WeakMap<any, any> = new WeakMap()): T {
    if (typeof value !== 'object') {
        return value;
    }

    const target = visited.get(value);
    if (target) {
        return target;
    }

    const valueAsAny = value as any;

    const proxyOriginal = valueAsAny[ORIGINAL];
    if (proxyOriginal) {
        visited.set(value, proxyOriginal);
        return removeDimmerMetadata(proxyOriginal, visited);
    }

    visited.set(value, target);

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            target[i] = removeDimmerMetadata(value[i], visited);
        }
    } else if (isMap(value)) {
        for (const [entryKey, entryValue] of value) {
            const dedimmeredKey = removeDimmerMetadata(entryKey, visited);
            const dedimmeredValue = removeDimmerMetadata(entryValue, visited);
            if (dedimmeredKey !== entryKey || dedimmeredValue !== entryValue) {
                target.delete(entryKey);
                target.set(dedimmeredKey, dedimmeredValue);
            }
        }
    } else if (isSet(value)) {
        for (const entryValue of value) {
            const dedimmeredValue = removeDimmerMetadata(entryValue, visited);
            if (dedimmeredValue !== entryValue) {
                target.delete(entryValue);
                target.add(dedimmeredValue);
            }
        }
    } else if (isPlainObject(value)) {
        for (const propertyKey of Object.keys(value)) {
            valueAsAny[propertyKey] = removeDimmerMetadata(valueAsAny[propertyKey], visited);
        }
    }
    else {
        throw new Error('unexpected type');
    }

    return value;
}