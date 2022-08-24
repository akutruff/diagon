import { createReactStore, StoreContext } from 'diagon-react';
import React, { FC, useState } from 'react';
import { createRootState } from './state';

export const ExampleApp: FC = ({ children }) => {
    const [store] = useState(() => createReactStore(createRootState()));

    return (
        <StoreContext.Provider value={store}>
            {children}
        </StoreContext.Provider>
    );
};