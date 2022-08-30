import { createReactRecorder } from 'diagon-react';
import React, { FC, memo } from 'react';

const { useSnap, useMutator, mutate } = createReactRecorder();

const state = { currentTime: '?' };

export const AsyncWithRecorder: FC = memo(() => {
    const currentTime = useSnap(state, state => state.currentTime);

    const fetch = useMutator(state, async (state) => {
        state.currentTime = undefined;

        const newTime = await fetchTime();

        mutate(state, state => state.currentTime = newTime);
    });

    return (
        <div>
            <div>{currentTime || 'fetching...'}</div>
            <button onClick={fetch} >Get time in 1 seconds</button>
        </div>
    );
});

const fetchTime = () => new Promise<string>(
    r => setTimeout(() => r(new Date().toLocaleTimeString()), 1000)); 