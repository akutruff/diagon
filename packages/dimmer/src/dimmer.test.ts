/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { clearContext, commitDeltas, createContext, createRecordingProxy, Dimmer, getCurrentDelta, makeDeltaRecorder, modified, recordDeltas, resetEnvironment } from './dimmer';
import { createReverseDelta } from './history';
import { Delta, ObjectDelta } from './types';

describe('Dimmer', () => {

    describe(`${createRecordingProxy.name}()`, () => {
        let target: {
            prop0: string
            prop1: number
        };

        beforeEach(() => {
            resetEnvironment();
            createContext();

            target = {
                prop0: 'hello',
                prop1: 42
            };
        });

        afterEach(() => {
            clearContext();
        });

        it('tracks changes', () => {
            const proxy = createRecordingProxy(target);

            expect(proxy.prop0).toEqual('hello');

            proxy.prop0 = 'foo';
            expect(proxy.prop0).toEqual('foo');
            //console.log('getPatch(target) :>> ', getPatch(target));
            expect(getCurrentDelta(target)!.get('prop0')).toEqual('hello');

            expect('prop1' in proxy).toEqual(true);
            expect(Reflect.ownKeys(target)).toContain('prop0');

            expect(proxy).toHaveProperty('prop0');
            expect(getCurrentDelta(target)!.has('prop0')).toBeTruthy();
        });
    });

    describe('change tracking', () => {
        beforeEach(() => {
            resetEnvironment();
            createContext();
        });

        afterEach(() => {
            clearContext();
        });

        describe(`${commitDeltas.name}`, () => {
            it('produces no changes when there are no changes', () => {
                const previouses = commitDeltas();
                expect(previouses).toEqual([]);
            });

            it('produces changes for primitive property changes', () => {
                const target = {
                    name: 'Bob'
                } as any;

                const proxy = createRecordingProxy(target);

                const initialChanges = commitDeltas();
                expect(initialChanges).toHaveLength(0);
                expect(modified.size).toEqual(0);

                proxy.name = 'Steve';
                const changes = commitDeltas();
                expect(changes).toHaveLength(1);
                expect(modified.size).toEqual(1);

                expect(changes[0]).not.toBe(target);

                expect(changes[0]).toMatchObject(new Map([['name', 'Bob']]));
                expect(changes).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining(new Map([['name', 'Bob']]))
                    ])
                );
            });

            it('handles referenced objects', () => {
                const otherObject = {
                    prop0: 2374236
                };

                const target: {
                    referencedObject?: typeof otherObject;
                } = {};

                const proxy = createRecordingProxy(target);
                commitDeltas();
                proxy.referencedObject = otherObject;

                const deltas = commitDeltas();

                expect(deltas).toHaveLength(1);

                expect(target.referencedObject).toEqual(otherObject);
                const patchFromChange = createReverseDelta(deltas[0]) as ObjectDelta<typeof target>;

                expect(patchFromChange.get('referencedObject')).toEqual(otherObject);
            });
        });
    });

    describe(`${recordDeltas.name}()`, () => {
        beforeEach(() => {
            resetEnvironment();
        });

        it('creates and clears contexts', () => {
            const state = { name: 'Jones', age: 1231 };
            const referenceToOriginalNonProxyState = state;
            type State = typeof state;
            const changeName = (state: State, newName: string) => {
                state.name = newName;
            };

            const changes = recordDeltas(changeName, state, 'Walker');

            expect(state).toBe(referenceToOriginalNonProxyState);
            expect(state.name).toEqual('Walker');

            expect(Dimmer.currentContext).toBeUndefined();
            expect(changes).toHaveLength(1);
            expect((changes[0] as ObjectDelta<State>).get('name')).toEqual('Jones');
        });

        it('records changes over multiple calls', () => {
            const state = { name: 'Jones', age: 1231 };
            type State = typeof state;
            const changeName = makeDeltaRecorder((state: State, newName: string) => {
                state.name = newName;
            });

            const changeHistory: Array<Array<Delta>> = [];

            changeHistory.push(changeName(state, 'Walker'));
            changeHistory.push(changeName(state, 'Texas'));
            expect(changeHistory).toHaveLength(2);
            expect(changeHistory[0]).toHaveLength(1);
            expect(changeHistory[1]).toHaveLength(1);

            expect(changeHistory[0][0]).toMatchObject(new Map([['name', 'Jones']]));
            expect(changeHistory[1][0]).toMatchObject(new Map([['name', 'Walker']]));
        });
    });
});
