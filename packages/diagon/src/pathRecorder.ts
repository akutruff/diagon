export const MapKeys: unique symbol = Symbol('MapKeys');
export const AnyProperty: unique symbol = Symbol('AnyProperty');

// export const Selector: unique symbol = Symbol('Selector');
// export const Selectors: unique symbol = Symbol('Selectors');
const RecordingTarget: unique symbol = Symbol('RecordingTarget');

export type SelectorFunction = (...args: unknown[]) => unknown;

export interface PathRecord extends Iterable<unknown> {
    [MapKeys]?: Map<unknown, unknown>,
    [AnyProperty]?: boolean,
    // [Selector]?: SelectorFunction,
    // [Selectors]?: Array<PathRecord>,
    [index: string]: any
}

interface PathRecordProxy extends PathRecord {
    [RecordingTarget]: any
}

/* eslint-disable @typescript-eslint/ban-types */
const pathRecorderProxy: ProxyHandler<any> = {
    get(target: any, propertyKey: PropertyKey) {
        let propertyValue = Reflect.get(target, propertyKey);

        //TODO: put in safety check such that property keys cannot be dynamic
        //if(Reflect.get(propertyKey as unknown as PathRecordProxy, RecordingTarget)) throw Error('map keys cannot be dynamic');

        if (propertyValue === undefined) {
            if (propertyKey === RecordingTarget) {
                return target;
            }

            if (propertyKey === MapKeys) {
                return propertyValue;
            }

            if (propertyKey === AnyProperty) {
                return propertyValue;
            }

            if (propertyKey === Symbol.iterator) {
                //TODO: decide if this is even useful to create a single child recorder.
                const childElementRecorder = createPathRecorderProxy();
                propertyValue = function* () { yield childElementRecorder; };

            } else {
                propertyValue = createPathRecorderProxy();
            }
            Reflect.set(target, propertyKey, propertyValue);
        }
        return propertyValue;
    }
};

let recordingModeStackCount = 0;

export const recordPath = <T>(pathAccessor: (target: T) => unknown): PathRecord => {
    try {
        recordingModeStackCount++;
        const recordingProxy = createPathRecorderProxy();

        pathAccessor(recordingProxy as unknown as T);

        return recordingProxy;
    }
    finally {
        recordingModeStackCount--;
    }
};

export const map_get = <K, V>(map: Map<K, V> | undefined, key: K): ReturnType<Map<K, V>['get']> | undefined => {
    if (recordingModeStackCount === 0) {
        return map?.get(key);
    } else {
        if ((key as any)[RecordingTarget]) throw Error('Map keys cannot be proxies themselves.');

        const mapPathProxy = (map as unknown as PathRecordProxy);
        if (!mapPathProxy[RecordingTarget][MapKeys]) mapPathProxy[RecordingTarget][MapKeys] = new Map<K, V>();
        const keyValues = mapPathProxy[RecordingTarget][MapKeys];

        let proxyForValue = keyValues.get(key);
        if (!proxyForValue) {
            proxyForValue = createPathRecorderProxy();
            keyValues.set(key, proxyForValue);
        }

        return proxyForValue as V;
    }
};

export const elements = <T extends Iterable<unknown> | undefined | null>(collection: T): T => {
    if (recordingModeStackCount === 0) {
        return collection;
    } else {
        if (!collection)
            return collection;
        const proxy = (collection as unknown as PathRecordProxy);

        //simply accessing the iterator property adds the default iterator to the recording proxy
        proxy[Symbol.iterator];

        return proxy as unknown as T;
    }
};

export const all = <T>(item: T): T => {
    if (recordingModeStackCount === 0) {
        return item;
    } else {
        if (!item)
            return item;
        const proxy = (item as unknown as PathRecordProxy);

        proxy[AnyProperty] = true;

        return proxy as unknown as T;
    }
};

const createPathRecorderProxy = (): PathRecordProxy => new Proxy({}, pathRecorderProxy);

export const deproxify = (pathRecord: Partial<PathRecordProxy>) => {
    if (!pathRecord[RecordingTarget]) {
        return pathRecord;
    }

    pathRecord = pathRecord[RecordingTarget];

    for (const propertyKey of Reflect.ownKeys(pathRecord)) {
        if (propertyKey === MapKeys) {
            pathRecord[MapKeys] = new Map(Array.from(pathRecord[MapKeys]!).map(([key, value]) => [key, deproxify(value as any)]));
        } else if (propertyKey === Symbol.iterator) {

            const iterator = (pathRecord as Iterable<any>)[Symbol.iterator]();
            const elementPathRecord = deproxify(iterator.next().value);

            (pathRecord as any)[Symbol.iterator] = function* () { yield elementPathRecord; };
        }
        else {
            (pathRecord as any)[propertyKey] = deproxify((pathRecord as any)[propertyKey]);
        }
    }

    return pathRecord;
};
