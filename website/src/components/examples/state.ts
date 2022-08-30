import { createReactRecorder, getTypedUseRootState } from 'diagon-react';

export const recorder = createReactRecorder();

export const createRootState = () => ({
    counter: 0
});

export type RootState = ReturnType<typeof createRootState>;

export const useAppState = getTypedUseRootState<RootState>();
