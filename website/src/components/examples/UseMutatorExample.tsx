import { useMutator, useSnap } from 'diagon-react';
import React, { FC } from 'react';
import { useAppState } from './state';

type Props = { multiplier: number };

export const UseMutatorExample: FC<Props> = React.memo(({ multiplier }) => {
    const state = useAppState();

    const counter = useSnap(state, state => state.counter);

    //A mutator without any arguments or dependencies.
    const incrementByOne = useMutator(state, state => state.counter += 1.);

    //You can give arbitrary arguments to your mutators.
    const add = useMutator(state, (state, amount: number) => state.counter += amount);

    //If you directly reference a prop inside your mutator, add it to your dependency list.  
    //  You could also have just passed it as an argument.
    const multiply = useMutator(state, state => state.counter *= multiplier, [multiplier]);

    return (
        <div>
            <div>value: {counter}</div>
            <button onClick={incrementByOne}>Add One</button>
            <button onClick={() => add(3)}>Add Three</button>
            <button onClick={multiply}>Multiply</button>
        </div>
    );
});