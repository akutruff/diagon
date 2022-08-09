
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

//export type ObjectDelta<T = unknown> = Partial<T>;
export type ObjectDelta<T = unknown> = Map<keyof T, T[keyof T]>;
export type ArrayDelta<T = unknown> = T[];
export type MapDelta<K = unknown, V = unknown> = Map<K, V>;
export type SetDelta<V = unknown> = Map<V, boolean>;

export type HistoryIndex<T> = [index: number, previous: T];

export type Delta = ObjectDelta<unknown> | ArrayDelta<unknown> | MapDelta<unknown, unknown> | SetDelta<unknown>;

export type InferDeltaType<T> =
    T extends Map<infer K, infer V>
    ? MapDelta<K, V>
    : T extends Array<infer E>
    ? ArrayDelta<E>
    : T extends Set<infer V>
    ? SetDelta<V>
    : ObjectDelta<T>;

export type Action = { type: string };

export type Mutator<TState, TArgs extends unknown[], R = unknown> = (state: TState, ...args: TArgs) => R;
