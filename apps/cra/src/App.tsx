import { PatchTrackerContext, usePatchTrackerContextValue } from 'diagon-react';
import React, { FC, useState } from 'react';
import { createRootState } from './app';
import { History } from './History';
import { Incrementor } from './Incrementor';
import { PeopleList } from './PeopleList';
import { PersonEditor } from './PersonEditor';
import { RenderCounter } from './RenderCounter';

const MainLayout: FC = React.memo(() => {
  return (
    <div style={{ marginLeft: 100 }}>
      <h2>Incrementor</h2>
      <Incrementor />
      <h2>Item Editing</h2>
      <div style={{ display: 'flex', gap: 10 }}>
        <PeopleList />
        <div style={{ alignSelf: 'flex-start' }}>
          <PersonEditor />
        </div>
      </div>
      <h2>Patch History</h2>
      <History />
    </div>
  );
});

const App: FC = () => {
  const [state] = useState(() => createRootState());

  const patchTrackerContextValue = usePatchTrackerContextValue({ state, dispatch: () => { } });

  return (
    <PatchTrackerContext.Provider value={patchTrackerContextValue}>
      <MainLayout />
      <div className='docked-bottom-right'>
        App <RenderCounter label={`<App/>`} />
      </div>

    </PatchTrackerContext.Provider>
  );
};

export default App;
