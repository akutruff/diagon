
import { isProxy, createRecorder, resetEnvironment, clearModified, DispatchContext, ObjectPatch, Patch } from '.';
import { Next } from './middleware';

describe('Recorder', () => {
    beforeEach(() => {
        resetEnvironment();
        clearModified();
    });

    afterEach(() => {
        clearModified();
    });

    type State = {
        prop0: string;
        prop1: number;
    };

    type PatchHistory = {
        history: Array<Patch[]>
    };

    describe('mutate', () => {
        it('supports middleware', async () => {
            const middleware = jest.fn((context: DispatchContext, next: Next) => {
                next();
            });

            const command = jest.fn(() => { });
            const recorder = createRecorder(middleware);
            recorder.mutate({}, command);

            expect(middleware.mock.calls.length).toBe(1);
            expect(command.mock.calls.length).toBe(1);
        });

        it('does not call command when middleware does not call next()', async () => {
            const middleware = jest.fn((_context: DispatchContext, _next: Next) => { });

            const command = jest.fn(() => { });
            const recorder = createRecorder(middleware);
            recorder.mutate({}, command);

            expect(middleware.mock.calls.length).toBe(1);
            expect(command.mock.calls.length).toBe(0);
        });

        it('informs middleware of reentrancy', async () => {
            const middlewareReentrancy: (number | undefined)[] = [];
            const middleware = jest.fn((context: DispatchContext, next: Next) => {
                middlewareReentrancy.push(context.pipelineStackDepth);
                next();
            });

            const reentrantCommand = jest.fn(() => { });

            const recorder = createRecorder(middleware);

            const command = jest.fn(() => {
                recorder.mutate({}, reentrantCommand);
            });

            recorder.mutate({}, command);

            expect(middlewareReentrancy).toEqual([0, 1]);

            expect(middleware.mock.calls.length).toBe(2);
            expect(command.mock.calls.length).toBe(1);
            expect(reentrantCommand.mock.calls.length).toBe(1);
        });

        it('records patches', async () => {
            const state: State = { prop0: 'hello', prop1: 2 };

            const middleware = jest.fn((context: DispatchContext, next: Next) => {
                next();
            });

            const command = jest.fn((state: State) => {
                expect(isProxy(state)).toBe(true);
                state.prop0 = 'adfaf';
            });

            const recorder = createRecorder(middleware);
            recorder.mutate(state, command);

            expect(state.prop0).toBe('adfaf');
            expect(middleware.mock.calls.length).toBe(1);
            expect(command.mock.calls.length).toBe(1);

            expect(middleware.mock.calls[0][0].patches?.length).toEqual(1);
            expect((middleware.mock.calls[0][0].patches![0] as ObjectPatch<State>).get('prop0')).toBe('hello');
        });
    });

    describe('mutateWithPatches', () => {
        it('records patches with patchHandler', async () => {
            const state: State = { prop0: 'hello', prop1: 2 };
            const patchHistory: PatchHistory = { history: [] };

            const middleware = jest.fn((context: DispatchContext, next: Next) => {
                next();
            });

            type CommandResult = { value: string };
            const command = jest.fn((state: State, valueToSet: string) => {
                expect(isProxy(state)).toBe(true);
                state.prop0 = valueToSet;

                return { value: 'commandResult' };
            });

            const patchHandler = jest.fn((patchHanlderState: PatchHistory, patches: Patch[], state: State, commandResult?: CommandResult, ...commandArgs: any[]) => {
                expect(isProxy(patchHanlderState)).toBe(true);
                expect(isProxy(state)).toBe(true);
                expect(commandResult?.value).toEqual('commandResult');
                expect(commandArgs).toEqual(['adfaf']);
                patchHanlderState.history.push(patches);
            });

            const recorder = createRecorder(middleware);
            recorder.mutateWithPatches(state, command, patchHistory, patchHandler, 'adfaf');

            expect(middleware.mock.calls.length).toBe(1);
            expect(command.mock.calls.length).toBe(1);
            expect(patchHandler.mock.calls.length).toBe(1);

            const dispatchContext = middleware.mock.calls[0][0];

            expect(state.prop0).toBe('adfaf');
            expect(patchHistory.history.length).toBe(1);
            expect(patchHistory.history).toEqual([dispatchContext.patches]);

            expect(dispatchContext.patches?.length).toEqual(1);
            expect((dispatchContext.patches![0] as ObjectPatch<State>).get('prop0')).toBe('hello');

            expect(dispatchContext.allPatchSetsFromPipeline[1]?.length).toEqual(1);
        });
        it.todo('allows patchHandlerState and patchState to be the same and/or different');
        it.todo('global patch recording middleware works');
    });
});