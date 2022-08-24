import { GlobalPatchHandlerMiddleware } from 'diagon';
import { createReactRecorder, StoreProvider } from 'diagon-react';
import React, { FC, useState } from 'react';
import { createRootState } from './app';
import { savePatchesToHistory } from './History';
import { MainLayout } from './MainLayout';
import { RenderCounter } from './RenderCounter';

const globalPatchRecording = new GlobalPatchHandlerMiddleware(savePatchesToHistory);
const recorder = createReactRecorder(globalPatchRecording.middleware);

const App: FC = () => {
  const [store] = useState(() => {
    const state = createRootState();
    globalPatchRecording.setPatchHandlerState(state);
    return { state, recorder };
  });

  return (
    <StoreProvider {...store}>
      <MainLayout />
      <div className='docked-bottom-right'>
        App
        <RenderCounter label={`<App/>`} />
      </div>
    </StoreProvider>
  );
};

export default App;
