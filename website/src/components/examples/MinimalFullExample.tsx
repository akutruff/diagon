import { createReactRecorder, StoreContext, useMutator, useRootState, useSnapshot } from 'diagon-react';
import React, { FC } from 'react';

const recorder = createReactRecorder();
const state = {
    counter: 0
};

export const Incrementor: FC = React.memo(() => {
    const state = useRootState();

    const counter = useSnapshot(state, state => state.counter);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div>
            <div>value: {counter}</div>
            <button onClick={increment}>Click me</button>
        </div>
    );
});

export const MinimalFullExample: FC = () => {
    return (
        <StoreContext.Provider value={{state, recorder}}>
            <Incrementor />
        </StoreContext.Provider>
    );
};