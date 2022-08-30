import { all, elements, Patch } from 'diagon';
import { createReactRecorder } from 'diagon-react';
import React, { FC, memo } from 'react';
import { recorder } from './state';

const { useSnap, useMutator, useMutatorWithPatches, mutate, mutateWithPatches } = createReactRecorder();

const state = {
    firstName: 'Allen',
    lastName: 'Turing',
    favoriteColor: 'purple'
};

type Operation = {
    type: string,
    patches: Patch[]
};

type History = { operations: Operation[] };

const history: History = {
    operations: []
};

// constructMutator(state, state => (name: string) => state.firstName = name);

// const addToHistory = recorder.createMutator(history, (history: History, patches: Patch[], type: string) => history.operations.push({ type, patches });

//TODO: switch patchHandlers to not take special state.  Simply expect them already to be wrapped as mutators.
const addToHistory = (history: History, patches: Patch[], type: string) => history.operations.push({ type, patches });

export const Editor: FC = memo(() => {
    //warning this may not update Andy!!! double check.
    const { firstName, lastName, favoriteColor } = useSnap(state, state => all(state));

    mutateWithPatches(
        state, state => state.firstName = firstName,
        history, (history, patches) => addToHistory(history, patches, 'setName'));


    const setFirstName = useMutatorWithPatches(
        state, (state, name: string) => state.firstName = name,
        history, (history, patches) => addToHistory(history, patches, 'setName'));

    const setLastName = useMutatorWithPatches(
        state, (state, name: string) => state.firstName = name,
        history, (history, patches) => addToHistory(history, patches, 'setName'));

    return (
        <div>
            <h5>Edit Person</h5>
            <div>
                <div>Name: {firstName} {lastName}</div>
                <div>Favorite Color: {favoriteColor}</div>
                <p>
                    Change name:
                    <input type="text" value={firstName} style={{ marginLeft: 5 }} onChange={ev => setFirstName(ev.target.value)} />
                    <input type="text" value={lastName} style={{ marginLeft: 5 }} onChange={ev => setLastName(ev.target.value)} />
                </p>
            </div>
        </div>
    );
});

export const History: FC = memo(() => {
    const [operations] = useSnap(history, history => [elements(history.operations)]);

    return (
        <div>
            History:
            {operations.map(x => <div>{x.type}</div>)}
        </div>
    );
});
