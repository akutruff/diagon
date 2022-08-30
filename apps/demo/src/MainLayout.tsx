import React, { FC } from 'react';
import { History } from './History';
import { Incrementor } from './Incrementor';
import { PeopleList } from './PeopleList';
import { PersonEditor } from './PersonEditor';

export const MainLayout: FC = React.memo(() => {
    return (
        <div style={{ marginLeft: 100 }}>
            <h2>Incrementor</h2>
            <Incrementor />
            <h2>Item Editing</h2>
            <div style={{ display: 'flex', gap: 10 }}>
                <PeopleList />
                <div style={{ alignSelf: 'flex-start' }}>
                    <PersonEditor />
                    <h2>Patch History</h2>
                    <History />
                </div>
            </div>
        </div>
    );
});
