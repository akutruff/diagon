import { useMutator, useSnapshot } from 'diagon-react';
import React, { CSSProperties, FC } from 'react';
import { useAppState } from './app';
import { RenderCounter } from './RenderCounter';

export const Incrementor: FC = React.memo(() => {
    const state = useAppState();

    const counter = useSnapshot(state, state => state.counter);
    const increment = useMutator(state, state => state.counter++);

    return (
        <div style={style}>
            <div style={buttonFormStyle}>
                <div>value: {counter}</div>
                <button type="button" onClick={increment}>Click me</button>
            </div >
            <br />
            <RenderCounter label="<Incrementor/>" />
        </div>
    );
});
const style: CSSProperties = {
    padding: 10,
    minWidth: 200,
    display: 'inline-block',
    borderRadius: 5,
    color: 'black',
    backgroundColor: 'lightgray'
};

const buttonFormStyle: CSSProperties = {
    display: 'flex',
    gap: 5
};
