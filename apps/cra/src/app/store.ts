import { createRecordingProxy } from 'diagon';
import { useRootState } from 'diagon-react';

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
        { id: 1, name: 'Alice', age: 40 },
        { id: 2, name: 'James', age: 19 },
        { id: 3, name: 'Jill', age: 60 },
        { id: 4, name: 'Raekwon', age: 52 },
        { id: 5, name: 'Alana', age: 28 },
    ];

    return createRecordingProxy({
        selectedPerson: people[0],
        people,
        counter: 0
    });
}