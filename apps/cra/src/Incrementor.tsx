import { useMutator, useSnapshot } from 'diagon-react';
import React, { CSSProperties, FC } from 'react';
import { useAppState } from './app';
import { RenderCounter } from './RenderCounter';

export const Incrementor: FC = React.memo(() => {
    const state = useAppState();

    const [counter] = useSnapshot(state, state => [state.counter]);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div>
            <div style={style}>
                <div>value: {counter}</div>
                <button type="button" onClick={increment}>Click me</button>
            </div >
            <br />
            <RenderCounter label="<Incrementor/>" />
        </div>
    );
});

const style: CSSProperties = {
    display: 'flex',
    gap: 5
};
