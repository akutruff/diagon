import { createRecordingProxy, useRootState as useDimmerRootState } from '@akutruff/dimmer';

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

export function useRootState(): RootState {
    return useDimmerRootState() as RootState;
}

export function createRootState(): RootState {
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

// export function initialize(state: RootState) {
//     console.log('initializing: ', state);
// }