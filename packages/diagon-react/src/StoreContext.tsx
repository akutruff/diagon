/* eslint-disable @typescript-eslint/ban-types */
import { SubscribingRecorder } from 'diagon';
import React, { createContext, FC, PropsWithChildren } from 'react';

export interface StoreContextValue {
    state?: any,
    recorder: SubscribingRecorder
}

export const StoreContext: React.Context<StoreContextValue> = createContext(undefined as any as StoreContextValue);

export const StoreProvider: FC<PropsWithChildren<StoreContextValue>> = ({ children, ...props }) => {
    return (
        <StoreContext.Provider value={props}>
            {children}
        </StoreContext.Provider>
    );
};