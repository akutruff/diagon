import { areSame } from 'diagon';
import { useProjectedSnapshot, useSnapshot } from 'diagon-react';
import React, { FC, useRef } from 'react';
import { Person, useAppState } from './app';
import { RenderCounter } from './RenderCounter';

export interface PersonDetailsProps {
    person: Person;
    onClick?: (person: Person) => unknown;
}

export const PersonDetails: FC<PersonDetailsProps> = React.memo(({ person, onClick }) => {
    const state = useAppState();

    const renderCount = useRef(0);
    renderCount.current += 1;
    const isSelected = useProjectedSnapshot(state, state => state.selectedPerson, state => areSame(state.selectedPerson, person), [person]);
    const [name, age] = useSnapshot(person, person => [person.name, person.age]);

    return (
        <button className="person-details button" style={isSelected ? { backgroundColor: '#4CAF50' } : undefined} onClick={() => onClick && onClick(person)}>
            <div>Name: {name}</div>
            <div>Age: {age}</div>
            <RenderCounter label={`<PersonDetailsProps/> ${name}`} />
        </button>
    );
});


