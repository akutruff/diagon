import { createReactRecorder, getTypedUseRootState } from 'diagon-react';

export const recorder = createReactRecorder();

export function createRootState() {
    const people = [
        { name: 'Bob', age: 42 },
        { name: 'Alice', age: 40 }
    ];

    return {
        selectedPerson: people[0],
        people,
        counter: 0
    };
}

export type RootState = ReturnType<typeof createRootState>;

export const useAppState = getTypedUseRootState<RootState>();
