/* eslint-disable @typescript-eslint/ban-types */
import { SubscribingRecorder } from 'diagon';
import { createContext } from 'react';

export interface StoreContextValue {
    state: any,
    recorder: SubscribingRecorder
}

export const StoreContext: React.Context<StoreContextValue> = createContext(undefined as any as StoreContextValue);
