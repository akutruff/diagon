/* eslint-disable @typescript-eslint/ban-types */

import { patchToSource, modified, objectToCurrentPatch, proxify, } from './diagon';
import { ORIGINAL, ObjectPatch } from './types';

export const objectProxyHandler: ProxyHandler<any> = {
    get(target: any, propertyKey: PropertyKey) {
        //console.log('propertyKey :>> ', propertyKey);
        switch (propertyKey) {
            case ORIGINAL: {
                return target;
            }
            default: {
                const propertyValue = Reflect.get(target, propertyKey);
                return proxify(propertyValue);
            }
        }
    },

    set: function (target: any, propertyKey: PropertyKey, value: any/*, _receiver?: any*/) {
        let patch = objectToCurrentPatch.get(target) as ObjectPatch<any> | undefined;
        if (!patch) {
            patch = createObjectPatch(target);
            objectToCurrentPatch.set(target, patch);
        }
        if (!patch.has(propertyKey)) {
            modified.add(target);

            const currentValue = target[propertyKey];
            patch.set(propertyKey, currentValue);
        }

        return Reflect.set(target, propertyKey, value);
    },
};

export function createObjectPatch<T>(target: T): ObjectPatch<T> {
    const patch = new Map<keyof T, T[keyof T]>();

    // const patch = {} as ObjectPatch<T>;
    patchToSource.set(patch, target);
    return patch;
}
