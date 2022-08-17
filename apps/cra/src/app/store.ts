import { createRecordingProxy, Patch } from 'diagon';
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
    history: HistoryTrackingState,
    nextPersonId: number
}

export function useAppState() {
    return useRootState() as RootState;
}

export function createPerson(state: RootState, person: Omit<Person, 'id'>) {
    return { ...person, id: state.nextPersonId++ };
}

export function createRootState() {
    let id = 0;
    const people = [
        { id: id++, name: 'Bob', age: 42 },
        { id: id++, name: 'Alice', age: 40 },
        { id: id++, name: 'James', age: 19 },
        { id: id++, name: 'Jill', age: 60 },
        { id: id++, name: 'Raekwon', age: 52 },
        { id: id++, name: 'Alana', age: 28 },
    ];

    return createRecordingProxy({
        selectedPerson: people[0],
        people,
        counter: 0,
        history: createHistoryTrackingState(),
        nextPersonId: id,
    });
}

export interface HistoryEntry {
    forward?: Patch[],
    back: Patch[],
}

export interface HistoryTrackingState {
    entries: HistoryEntry[],
    isTimeTraveling: boolean,
    timeTravelOffset: number
}

export function createHistoryTrackingState(): HistoryTrackingState {
    return {
        entries: [],
        isTimeTraveling: false,
        timeTravelOffset: 0
    };
}
