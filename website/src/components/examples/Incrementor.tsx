import { useMutator, useSnapshot } from 'diagon-react';
import React, { FC } from 'react';
import { useAppState } from './state';

export const Incrementor: FC = React.memo(() => {
    const state = useAppState();

    const counter = useSnapshot(state, state => state.counter);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div>
            <div>value: {counter}</div>
            <button onClick={increment}>Click me</button>
        </div>
    );
});