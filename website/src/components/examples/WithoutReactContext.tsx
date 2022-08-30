import { createReactRecorder } from 'diagon-react';
import React, { FC } from 'react';

const recorder = createReactRecorder();
// highlight-next-line
const { useSnap, useMutator } = recorder;

const state = {
    counter: 0
};

export const Incrementor: FC = React.memo(() => {
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
    return (
        <Incrementor />
    );
};