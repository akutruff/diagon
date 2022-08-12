import { elements } from 'diagon';
import { useMutator, useSnapshot } from 'diagon-react';
import React, { FC } from 'react';
import { Person, useAppState } from './app';
import { PersonDetails } from './PersonDetails';

export const PeopleList: FC = React.memo(() => {
    const state = useAppState();

    const [people] = useSnapshot(state, state => [elements(state.people)]);

    const selectPerson = useMutator(state, (state, person: Person) => state.selectedPerson = person);

    const peopleDetails = people.map(x => <PersonDetails key={x.id} person={x} onClick={selectPerson} />);

    return (
        <div className='people-list'>
            {peopleDetails}
        </div>
    );
});
