import { GlobalPatchHandlerMiddleware } from 'diagon';
import { createReactRecorder, createReactStore, StoreContext } from 'diagon-react';
import React, { FC, useState } from 'react';
import { createRootState } from './app';
import { History, savePatchesToHistory } from './History';
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
          <h2>Patch History</h2>
          <History />
        </div>
      </div>
    </div>
  );
});

const globalPatchRecording = new GlobalPatchHandlerMiddleware(savePatchesToHistory);
const recorder = createReactRecorder(globalPatchRecording.middleware);

const App: FC = () => {
  const [store] = useState(() => {
    const state = createRootState();
    globalPatchRecording.setPatchHandlerState(state);
    return { state, recorder };
  });

  return (
    <StoreContext.Provider value={store}>
      <MainLayout />
      <div className='docked-bottom-right'>
        App <RenderCounter label={`<App/>`} />
      </div>
    </StoreContext.Provider>
  );
};

export default App;
