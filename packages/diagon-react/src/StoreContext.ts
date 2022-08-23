/* eslint-disable @typescript-eslint/ban-types */
import { createContext } from 'react';
import { ReactStore } from './reactMiddleware';

export const StoreContext: React.Context<ReactStore<any>> = createContext(undefined as any as ReactStore<any>);
