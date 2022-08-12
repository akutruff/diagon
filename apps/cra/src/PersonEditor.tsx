import { useMutator, useSnapshot } from 'diagon-react';
import React, { ChangeEvent, FC } from 'react';
import { useAppState } from './app';
import { RenderCounter } from './RenderCounter';

export const PersonEditor: FC = React.memo(() => {
    const state = useAppState();
    const [name, age] = useSnapshot(state, state => [state.selectedPerson.name, state.selectedPerson.age]);

    const onChangeName = useMutator(state, (state, ev: ChangeEvent<HTMLInputElement>) => state.selectedPerson.name = ev.target.value);

    return (
        <div className='person-editor'>
            <h5>Edit Person</h5>
            <div>
                <div>Name: {name}</div>
                <div>Age: {age}</div>
                <p>                Change name
                    <input type="text" value={name} style={{ marginLeft: 5 }} onChange={onChangeName} />
                </p>
            </div>
            <RenderCounter label={`<PersonEditor/>`} />
        </div>
    );
});
