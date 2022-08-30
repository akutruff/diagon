import { createReactRecorder, StoreProvider, useMutator, useRootState, useSnap } from 'diagon-react';
import React, { FC, useState } from 'react';

const recorder = createReactRecorder();

type State = { counter: number };

export const Incrementor: FC = React.memo(() => {
    const state = useRootState() as State;

    const counter = useSnap(state, state => state.counter);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div>
            <div>value: {counter}</div>
            <button onClick={increment}>Click me</button>
        </div>
    );
});

export const App: FC = () => {
    const [store] = useState(() => ({ state: { counter: 0 }, recorder }));

    return (
        <StoreProvider {...store}>
            <Incrementor />
        </StoreProvider>
    );
};