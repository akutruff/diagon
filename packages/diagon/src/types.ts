
/* eslint-disable @typescript-eslint/no-unused-vars */
export const PROXY: unique symbol = Symbol('PROXY');
export const DIAGON_ID: unique symbol = Symbol('DIAGON_ID');
export const NO_ENTRY: unique symbol = Symbol('NO_ENTRY');
export const ORIGINAL: unique symbol = Symbol('ORIGINAL');

export interface DiagonEnvironment {
    nextId: number,
    currentContext?: DiagonContext
}

export interface DiagonProxyMetadata {
    [DIAGON_ID]: DiagonId;
    [PROXY]: any;
}

export interface DiagonedArray<T = unknown> extends Array<T>, DiagonProxyMetadata {
    [PROXY]: DiagonedArray<T>;
}

export interface DiagonedObject<T = any> extends DiagonProxyMetadata {
    [key: string]: any;
    [PROXY]: DiagonedObject<T>;
}

export interface DiagonContext {
    modified: Set<any>;
}

export type DiagonId = number;

export interface DiagonContext {
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
