import { createRecordingProxy } from 'diagon';
import { useRootState } from 'diagon-react';

export function createRootState() {
    const people = [
        { name: 'Bob', age: 42 },
        { name: 'Alice', age: 40 }
    ];

    return createRecordingProxy({
        selectedPerson: people[0],
        people,
        counter: 0
    });
}

export type RootState = ReturnType<typeof createRootState>;

export function useAppState() {
    return useRootState() as RootState;
}
