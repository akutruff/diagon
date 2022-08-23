/* eslint-disable @typescript-eslint/ban-types */
import { createContext, useMemo, useState } from 'react';
import { ReactStore } from './reactMiddleware';

export const StoreContext: React.Context<StoreContextValue> = createContext(undefined as any as StoreContextValue);

export interface StoreContextValue {
    store: ReactStore<any>
    setContextProps: (props: ReactStore<any>) => void;
}

export const createStoreContextValue = (store: ReactStore<any>, setContextProps: (props: ReactStore<any>) => void = (() => { })): StoreContextValue => {
    return {
        store,
        setContextProps
    };
};

export const useStoreContext = (store: ReactStore<any>): StoreContextValue => {
    const [storeState, setStoreState] = useState(store);
    //TODO: verify that useMemo is okay instead of useState, since useMemo may not be guaranteed to cache.
    const value = useMemo(() => createStoreContextValue(storeState, setStoreState), [store]);
    return value;
};
