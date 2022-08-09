import { deltaToTarget, modified, objectToCurrentDelta, proxify } from './dimmer';
import { ArrayDelta, ORIGINAL, PROXY } from './types';

export const dimmerArrayProxyHandler: ProxyHandler<any> = {

    get(target: any, propertyKey: PropertyKey, receiver?: any) {
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

    //TODO: set and delete are presently just copying all previous contents.  Perhaps this could be more piecemeal.
    set: function (target: any, propertyKey: PropertyKey, value: any/*, _receiver?: any*/) {
        const currentDelta = objectToCurrentDelta.get(target);
        if (!currentDelta) {
            modified.add(target);

            const delta = createArrayDelta(target);

            delta.length = target.length;
            for (let i = 0; i < target.length; i++) {
                delta[i] = target[i];
            }

            objectToCurrentDelta.set(target, delta);
        }

        return Reflect.set(target, propertyKey, value);
    },

    deleteProperty(target, prop: PropertyKey) {
        const currentDelta = objectToCurrentDelta.get(target);
        if (!currentDelta) {
            modified.add(target);
            const delta = createArrayDelta(target);

            delta.length = target.length;
            for (let i = 0; i < target.length; i++) {
                delta[i] = target[i];
            }

            objectToCurrentDelta.set(target, delta);
        }

        return Reflect.deleteProperty(target, prop);
    },
};

export function createArrayDelta<T>(target: T[]) {
    const delta = [] as any as ArrayDelta;
    deltaToTarget.set(delta, target);
    return delta;
}

