import { createRecordingProxy } from '@akutruff/dimmer';
import { useRootState } from '@akutruff/dimmer-react';

export interface Person {
    id: number,
    name: string,
    age: number,

}

export interface RootState {
    selectedPerson: Person,
    people: Person[],
    counter: number,
}

export function useAppState() {
    return useRootState() as RootState;
}

export function createRootState() {
    const people = [
        { id: 0, name: 'Bob', age: 42 },
        { id: 1, name: 'Alice', age: 40 }
    ];

    return createRecordingProxy({
        selectedPerson: people[0],
        people,
        counter: 0
    });
}