import { assignDimmerId, asOriginal, patchToTarget } from './dimmer';
import { createArrayPatch } from './dimmerArray';
import { createMapPatch, getKeyUsedByMap } from './dimmerMap';
import { createObjectPatch } from './dimmerObject';
import { createSetPatch } from './dimmerSet';

import { Patch, DIMMER_ID, ORIGINAL, InferPatchType, NO_ENTRY, SetPatch, ArrayPatch, MapPatch, ObjectPatch, HistoryIndex, DimmeredObject } from './types';
import { isMap, isPlainObject, isSet } from './utils';

export function undoPatch(patch: Patch) {
    const target = patchToTarget.get(patch);

    if (target instanceof Map) {
        const mapPatch = patch as MapPatch;
        for (const [key, value] of mapPatch) {
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
        const setPatch = patch as SetPatch;

        for (const [key, wasPreviouslyInSet] of setPatch) {
            if (wasPreviouslyInSet) {
                target.add(key);
            } else {
                target.delete(key);
            }
        }
    } else if (Array.isArray(target)) {
        const arrayPatch = patch as ArrayPatch;
        target.length = arrayPatch.length;

        for (let i = 0; i < arrayPatch.length; i++) {
            target[i] = arrayPatch[i];
        }
    } else {
        //TODO: decide if an object's "own properties" will be modified because we're using undefined.  We could switch to NO_ENTRY
        //Object.assign(target, patch);
        for (const [key, value] of (patch as ObjectPatch)) {
            target[key] = value;
        }
    }
}

export function createReversePatch(patch: Patch) {
    const target = patchToTarget.get(patch);
    if (target instanceof Map) {
        const reversePatch = createMapPatch(target);
        const mapPatch = patch as MapPatch;

        for (const key of mapPatch.keys()) {
            if (!target.has(key)) {
                reversePatch.set(key, NO_ENTRY);
            } else {
                reversePatch.set(key, target.get(key));
            }
        }
        return reversePatch;
    } else if (target instanceof Set) {
        const reversePatch = createSetPatch(target);
        const setPatch = patch as SetPatch;

        for (const key of setPatch.keys()) {
            const wasObjectRemovedInTarget = target.has(key);
            reversePatch.set(key, wasObjectRemovedInTarget);
        }
        return reversePatch;
    } else if (Array.isArray(target)) {
        const targetArray = target as unknown[];

        const reversePatch = createArrayPatch(target as unknown[]);
        reversePatch.length = targetArray.length;

        for (let i = 0; i < targetArray.length; i++) {
            reversePatch[i] = targetArray[i];
        }

        return reversePatch;
    } else {
        const reversePatch: ObjectPatch<any> = createObjectPatch(target);

        // const patchKeys = Object.keys(patch);

        for (const key of patch.keys()) {
            reversePatch.set(key as any, (target as any)[(key as any)]);
            // (patch as any)[key] = (target as any)[key];
        }

        return reversePatch;
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

export function getObjectTimeline<T>(history: Patch[][], objectToFind: T): HistoryIndex<InferPatchType<T>>[] {
    const original = asOriginal(objectToFind);

    const timeline = history.map((patches, index): HistoryIndex<InferPatchType<T>> | undefined => {
        const patchForOriginal = findPatchForObject(patches, original);
        return patchForOriginal ? [index, patchForOriginal] : undefined;
    }).filter((x): x is HistoryIndex<InferPatchType<T>> => x !== undefined);

    return timeline;
}

export function findPatchForObject<T>(patches: Patch[], objectToFind: T): InferPatchType<T> | undefined {
    const objTarget = asOriginal(objectToFind);

    const patchForTarget = patches.find(x => patchToTarget.get(x) === objTarget);
    return patchForTarget as InferPatchType<T> | undefined;
}

export function findAllPatchesInHistory<T>(history: Patch[][], objectToFind: T): InferPatchType<T>[] {
    const objTarget = asOriginal(objectToFind);
    const patchesInHistory = history.flat().filter((x): x is InferPatchType<T> => patchToTarget.get(x) === objTarget);

    return patchesInHistory;
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