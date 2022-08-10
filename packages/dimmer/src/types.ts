
/* eslint-disable @typescript-eslint/no-unused-vars */
export const PROXY: unique symbol = Symbol('PROXY');
export const DIMMER_ID: unique symbol = Symbol('DIMMER_ID');
export const NO_ENTRY: unique symbol = Symbol('NO_ENTRY');
export const ORIGINAL: unique symbol = Symbol('ORIGINAL');

export interface DimmerEnvironment {
    nextId: number,
    currentContext?: DimmerContext
}

export interface DimmerProxyMetadata {
    [DIMMER_ID]: DimmerId;
    [PROXY]: any;
}

export interface DimmeredArray<T = unknown> extends Array<T>, DimmerProxyMetadata {
    [PROXY]: DimmeredArray<T>;
}

export interface DimmeredObject<T = any> extends DimmerProxyMetadata {
    [key: string]: any;
    [PROXY]: DimmeredObject<T>;
}

export interface DimmerContext {
    modified: Set<any>;
}

export type DimmerId = number;

export interface DimmerContext {
    modified: Set<any>;
}

//export type ObjectPatch<T = unknown> = Partial<T>;
export type ObjectPatch<T = unknown> = Map<keyof T, T[keyof T]>;
export type ArrayPatch<T = unknown> = T[];
export type MapPatch<K = unknown, V = unknown> = Map<K, V>;
export type SetPatch<V = unknown> = Map<V, boolean>;

export type HistoryIndex<T> = [index: number, previous: T];

export type Patch = ObjectPatch<unknown> | ArrayPatch<unknown> | MapPatch<unknown, unknown> | SetPatch<unknown>;

export type InferPatchType<T> =
    T extends Map<infer K, infer V>
    ? MapPatch<K, V>
    : T extends Array<infer E>
    ? ArrayPatch<E>
    : T extends Set<infer V>
    ? SetPatch<V>
    : ObjectPatch<T>;

export type Action = { type: string };

export type Mutator<TState, TArgs extends unknown[], R = unknown> = (state: TState, ...args: TArgs) => R;
