import { asOriginal, tryGetProxy, proxify, patchToTarget, modified } from './dimmer';
import { ORIGINAL, PROXY, SetPatch, DimmerProxyMetadata, DIMMER_ID, DimmerId } from './types';

export class DimmerSet<T> extends Set<T> implements DimmerProxyMetadata {
    currentPatch = new Map<T, boolean>();

    [DIMMER_ID]: DimmerId = -1;

    constructor(private target: Set<T>) {
        super();
        Object.defineProperty(target, PROXY, { value: this, enumerable: false, configurable: true, writable: true });
    }

    get size(): number {
        return this.target.size;
    }

    has(value: T): boolean {
        const proxyOfKey = tryGetProxy(value);
        return proxyOfKey && this.target.has(proxyOfKey) || this.target.has(asOriginal(value));
    }

    add(value: T) {
        const proxyOfValue = tryGetProxy(value);
        const originalValue = asOriginal(value);

        const currentKeyUsedByTarget = getKeyUsedBySet(this.target, value, proxyOfValue, originalValue);

        if (!currentKeyUsedByTarget) {
            const hasChangeAlreadyBeenRecorded = (proxyOfValue && this.currentPatch.has(proxyOfValue)) || this.currentPatch.has(originalValue);
            if (!hasChangeAlreadyBeenRecorded) {
                modified.add(this.target);

                this.currentPatch.set(value, false);
            }
        }

        this.target.add(currentKeyUsedByTarget || value);

        return this;
    }

    delete(value: T): boolean {
        const proxyOfValue = tryGetProxy(value);
        const originalValue = asOriginal(value);

        let currentKeyUsedByTarget;
        if (this.target.delete(proxyOfValue!)) {
            currentKeyUsedByTarget = proxyOfValue;
        } else if (this.target.delete(originalValue)) {
            currentKeyUsedByTarget = originalValue;
        }

        if (currentKeyUsedByTarget) {
            const hasChangeAlreadyBeenRecorded = (proxyOfValue && this.currentPatch.has(proxyOfValue)) || this.currentPatch.has(originalValue);

            if (!hasChangeAlreadyBeenRecorded) {
                modified.add(this.target);
                this.currentPatch.set(currentKeyUsedByTarget, true);
            }
            return true;
        } else {
            return false;
        }
    }

    clear() {
        for (const value of this.target) {
            if (!this.currentPatch.has(value)) {
                modified.add(this.target as any);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                this.currentPatch.set(value, true);
            }
        }

        return this.target.clear();
    }

    forEach(
        cb: (value1: T, value2: T, self: Set<T>) => void, thisArg?: any) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return this.target.forEach((value1, value2, set) => cb.call(thisArg, proxify(value1), proxify(value2), this), this);
    }

    *values(): IterableIterator<T> {
        for (const value of this.target.values()) {
            yield proxify(value);
        }
    }

    *entries(): IterableIterator<[T, T]> {
        for (const value of this.target.values()) {
            const valueProxy = proxify(value);
            yield [valueProxy, valueProxy];
        }
    }

    commitPatch(): SetPatch<T> {
        //TODO: instead of copying, perhaps just send current
        const commitedPatch = new Map(this.currentPatch) as SetPatch<T>;
        patchToTarget.set(commitedPatch, this.target);

        this.currentPatch.clear();
        return commitedPatch;
    }

    get [ORIGINAL]() {
        return this.target;
    }

    get [PROXY]() {
        return this;
    }

    [Symbol.iterator]() {
        return this.values();
    }
}

export function createSetPatch<T>(target: Set<T>) {
    const patch = (new Map<any, boolean>()) as SetPatch<T>;
    patchToTarget.set(patch, target);
    return patch;
}

export function getKeyUsedBySet<T>(map: Set<T>, value: T, proxyOfKey = tryGetProxy(value), originalKey = asOriginal(value)) {
    return proxyOfKey && map.has(proxyOfKey)
        ? proxyOfKey
        : map.has(originalKey)
            ? originalKey
            : undefined;
}