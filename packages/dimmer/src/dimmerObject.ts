/* eslint-disable @typescript-eslint/ban-types */

import { deltaToTarget, modified, objectToCurrentDelta, proxify, } from './dimmer';
import { ORIGINAL, PROXY, ObjectDelta } from './types';

export const objectProxyHandler: ProxyHandler<any> = {
    get(target: any, propertyKey: PropertyKey, receiver?: any) {
        //console.log('propertyKey :>> ', propertyKey);
        switch (propertyKey) {
            case ORIGINAL: {
                return target;
            }
            case PROXY: {
                return receiver;
            }
            default: {
                const propertyValue = Reflect.get(target, propertyKey);
                return proxify(propertyValue);
            }
        }
    },

    set: function (target: any, propertyKey: PropertyKey, value: any/*, _receiver?: any*/) {
        let delta = objectToCurrentDelta.get(target) as ObjectDelta<any> | undefined;
        if (!delta) {
            delta = createObjectDelta(target);
            objectToCurrentDelta.set(target, delta);
        }
        if (!delta.has(propertyKey)) {
            modified.add(target);

            const currentValue = target[propertyKey];
            delta.set(propertyKey, currentValue || undefined);
        }

        return Reflect.set(target, propertyKey, value);
    },
};

export function createObjectDelta<T>(target: T): ObjectDelta<T> {
    const delta = new Map<keyof T, T[keyof T]>();

    // const delta = {} as ObjectDelta<T>;
    deltaToTarget.set(delta, target);
    return delta;
}
