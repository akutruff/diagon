import { StoreProvider } from 'diagon-react';
import React, { FC, useState } from 'react';
import { createRootState, recorder } from './state';

export const ExampleApp: FC = ({ children }) => {
    const [store] = useState(() => ({ state: createRootState(), recorder }));

    return (
        <StoreProvider {...store}>
            {children}
        </StoreProvider>
    );
};