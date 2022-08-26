/* eslint-disable @typescript-eslint/ban-types */
import React, { createContext, FC, PropsWithChildren } from 'react';
import { ReactRecorder } from './reactMiddleware';

export interface StoreContextValue {
    state?: any,
    recorder: ReactRecorder
}

export const StoreContext: React.Context<StoreContextValue> = createContext(undefined as any as StoreContextValue);

export const StoreProvider: FC<PropsWithChildren<StoreContextValue>> = ({ children, ...props }) => {
    return (
        <StoreContext.Provider value={props}>
            {children}
        </StoreContext.Provider>
    );
};