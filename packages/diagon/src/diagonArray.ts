import { patchToSource, modified, objectToCurrentPatch, proxify } from './diagon';
import { ArrayPatch, ORIGINAL } from './types';

export const diagonArrayProxyHandler: ProxyHandler<any> = {

    get(target: any, propertyKey: PropertyKey) {
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

    //TODO: set and delete are presently just copying all previous contents.  Perhaps this could be more piecemeal.
    set: function (target: any, propertyKey: PropertyKey, value: any/*, _receiver?: any*/) {
        const currentPatch = objectToCurrentPatch.get(target);
        if (!currentPatch) {
            modified.add(target);
            const patch = createArrayPatch(target);

            patch.length = target.length;
            for (let i = 0; i < target.length; i++) {
                patch[i] = target[i];
            }

            objectToCurrentPatch.set(target, patch);
        }

        return Reflect.set(target, propertyKey, value);
    },

    deleteProperty(target, prop: PropertyKey) {
        const currentPatch = objectToCurrentPatch.get(target);
        if (!currentPatch) {
            modified.add(target);
            const patch = createArrayPatch(target);

            patch.length = target.length;
            for (let i = 0; i < target.length; i++) {
                patch[i] = target[i];
            }

            objectToCurrentPatch.set(target, patch);
        }

        return Reflect.deleteProperty(target, prop);
    },
};

export function createArrayPatch<T>(target: T[]) {
    const patch = [] as any as ArrayPatch;
    patchToSource.set(patch, target);
    return patch;
}

