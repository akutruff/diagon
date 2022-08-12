/* eslint-disable @typescript-eslint/ban-types */

const weakMemoize = <T extends object, R>(functionToMemoize: (arg: T) => R, cache: WeakMap<T, R> = new WeakMap<T, R>()) => (arg: T): R => {
    let result = cache.get(arg);
    if (!result) {
        result = functionToMemoize(arg);
        cache.set(arg, result);
    }
    return result as R;
};

let accessRecorderAccessed = new Map<object, any>();
const accessRecordProxy: ProxyHandler<any> = {
    get(target: any, propertyKey: PropertyKey) {
        //console.log('propertyKey :>> ', propertyKey);
        const propertyValue = Reflect.get(target, propertyKey);
        const proxiedValue =
            typeof propertyValue !== 'object' || !propertyValue
                ? propertyValue
                : getAccessRecorder(propertyValue);
        let accessRecord = accessRecorderAccessed.get(target);
        if (!accessRecord) {
            accessRecord = {};
            accessRecorderAccessed.set(target, accessRecord);
        }
        accessRecord[propertyKey] = propertyValue;

        // return Reflect.set(propertySnaps, propertyKey, propertyValue);
        return proxiedValue;
    }
};

const createAccessRecorderProxy = <T extends object>(target: T): T => {
    return new Proxy<T>(target, accessRecordProxy);
};

const propertyAccessRecorderCache = new WeakMap<object, ReturnType<typeof createAccessRecorderProxy>>();
const getAccessRecorder = weakMemoize(createAccessRecorderProxy, propertyAccessRecorderCache);

export const recordAccess = <T extends object>(target: T, accessor: (target: T) => unknown) => {
    const recorder = getAccessRecorder(target) as T;
    try {
        accessRecorderAccessed.set(target, {});
        accessor(recorder);
        const accessedThisTime = accessRecorderAccessed;
        return accessedThisTime;
    }
    finally {
        accessRecorderAccessed = new Map<object, any>();
    }
};