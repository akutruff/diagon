export function isPlainObject(value: any): boolean {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return !proto || proto === Object.prototype;
}


/*#__PURE__*/
export function isMap(target: any): target is Map<any, any> {
    return target instanceof Map;
}

/*#__PURE__*/
export function isSet(target: any): target is Set<any> {
    return target instanceof Set;
}

type Arr = unknown[];

export function applyPartial<T extends Arr, U extends Arr, R>(fn: (...args: [...T, ...U]) => R, ...headArgs: T) {
    return (...tailArgs: U) => fn(...headArgs, ...tailArgs);
}

