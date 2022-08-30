import { createReactRecorder } from 'diagon-react';
import React, { FC, memo } from 'react';

const { useSnap, useMutator } = createReactRecorder();

const state = {
    counter: 0
};

export const Incrementor: FC = memo(() => {
    const counter = useSnap(state, state => state.counter);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div>
            <div>value: {counter}</div>
            <button onClick={increment}>Click me</button>
        </div>
    );
});

export const App: FC = () => <Incrementor />;