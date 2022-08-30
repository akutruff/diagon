import { elements } from 'diagon';
import { useMutator, useSnapshot } from 'diagon-react';
import React, { FC } from 'react';
import { createPerson, Person, useAppState } from './app';
import { PersonDetails } from './PersonDetails';

export const PeopleList: FC = React.memo(() => {
    const state = useAppState();

    const [people] = useSnapshot(state, state => [elements(state.people)]);

    const selectPerson = useMutator(state, (state, person: Person) => state.selectedPerson = person);
    const addPerson = useMutator(state, (state) => state.people.push(createPerson(state, { name: 'New', age: Math.floor(Math.random() * 80) })));

    const peopleDetails = people.map(x => <PersonDetails key={x.id} person={x} onClick={selectPerson} />);

    return (
        <div className='people-list'>
            <button type="button" onClick={addPerson}>Add Person</button>
            {peopleDetails}
        </div>
    );
});
