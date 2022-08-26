
/* eslint-disable @typescript-eslint/no-unused-vars */
export const NO_ENTRY: unique symbol = Symbol('NO_ENTRY');
export const ORIGINAL: unique symbol = Symbol('ORIGINAL');

//TODO: Decide if id's will be supported
export const DIAGON_ID: unique symbol = Symbol('DIAGON_ID');

//TODO: decide if environments will be used or if only globals
export interface DiagonEnvironment {
    nextId: number,
    currentContext?: DiagonContext
}

export interface DiagonProxyMetadata {
    [DIAGON_ID]: DiagonId;
}

export interface DiagonArray<T = unknown> extends Array<T>, DiagonProxyMetadata {
}

export interface DiagonObject<T = any> extends DiagonProxyMetadata {
    [key: string]: any;
}

//TODO: decided if contexts should used for change scoping.
export interface DiagonContext {
    modified: Set<any>;
}

//TODO: decided if Id's should be supported
export type DiagonId = number;

export interface DiagonContext {
    modified: Set<any>;
}

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

export type Mutator<TState, TArgs extends unknown[], R = unknown> = (state: TState, ...args: TArgs) => R;

export type PatchHandler<TPatchHandlerState extends object, TState extends object, TArgs extends unknown[], R> =
    (patchHandlerState: TPatchHandlerState, patches: Patch[], state: TState, mutatorResult?: R, ...args: Partial<TArgs>) => unknown;

