import { configureGlobalPatchRecording } from 'diagon';
import { SubscriptionContext, useSubscriptionContextValue } from 'diagon-react';
import React, { FC, useMemo, useState } from 'react';
import { createRootState } from './app';
import { globalHistoryMiddlware, History } from './History';
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

const App: FC = () => {
  const [state] = useState(() => createRootState());

  const globalPatchRecordingMiddleware = useMemo(() => configureGlobalPatchRecording(state, globalHistoryMiddlware), [state]);

  const subscriptionContextValue = useSubscriptionContextValue({ state }, globalPatchRecordingMiddleware);

  return (
    <SubscriptionContext.Provider value={subscriptionContextValue}>
      <MainLayout />
      <div className='docked-bottom-right'>
        App <RenderCounter label={`<App/>`} />
      </div>
    </SubscriptionContext.Provider>
  );
};

export default App;
