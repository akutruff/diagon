import { elements } from '@akutruff/dimmer';
import { PatchTrackerContext, usePatchTrackerContextValue, useMutator, useSnapshot } from '@akutruff/dimmer-react';
import React, { ChangeEvent, FC, useState } from 'react';
import { createRootState, Person, useRootState } from './app';

const Incrementor: FC = React.memo(() => {
  const state = useRootState();
  const [counter] = useSnapshot(state, state => [state.counter]);
  const onIncrement = useMutator(state, state => state.counter++);

  console.log(`rendering <Counter/> ${counter}`);

  return (
    <div>
      <div>value: {counter}</div>
      <button
        type="button"
        onClick={onIncrement}
      >
        Click me
      </button>
    </div>
  );
});

export interface PersonDetailsProps {
  person: Person;
  selector?: (person: Person) => unknown;
}

const PersonDetails: FC<PersonDetailsProps> = React.memo(({ person, selector }) => {
  const [name, age] = useSnapshot(person, person => [person.name, person.age]);
  console.log(`rendering <PersonDetailsProps/> ${name}`);

  return (
    <div style={{ marginTop: 10 }} onClick={() => selector && selector(person)}>
      <div>Name: {name}</div>
      <div>Age: {age}</div>

    </div>
  );
});

const PersonInspector: FC = React.memo(() => {
  const state = useRootState();
  const [name, age] = useSnapshot(state, state => [state.selectedPerson.name, state.selectedPerson.age]);

  const onChangeName = useMutator(state, (state, ev: ChangeEvent<HTMLInputElement>) => state.selectedPerson.name = ev.target.value);
  console.log(`rendering <PersonInspector/>`);

  return (
    <div>
      <div>Name: {name}</div>
      <div>Age: {age}</div>
      <input type="text" value={name} onChange={onChangeName} />
    </div>
  );
});


const AppContent: FC = React.memo(() => {
  const state = useRootState();

  const [people] = useSnapshot(state, state => [elements(state.people)]);

  const selectPerson = useMutator(state, (state, person: Person) => state.selectedPerson = person);
  console.log('rendering <AppContent/> ');

  const peopleDetails = people.map(x =>
    <div style={{ backgroundColor: 'lightblue' }}>
      <PersonDetails key={x.id} person={x} selector={selectPerson} />
    </div>);

  return (
    <div>
      <Incrementor />
      <h5>Selected</h5>
      <PersonInspector />
      <h5>People</h5>
      <div>
        {peopleDetails}
      </div>
    </div>
  );
});

const App: FC = () => {
  console.log('rendering <App/> ');

  const [state] = useState(() => createRootState());

  const patchTrackerContextValue = usePatchTrackerContextValue({ state, dispatch: () => { } });

  return (
    <PatchTrackerContext.Provider value={patchTrackerContextValue}>
      <AppContent />
    </PatchTrackerContext.Provider>
  );
};

export default App;
