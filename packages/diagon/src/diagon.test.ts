/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { clearModified, endRecording, createReversePatch, createRecordingProxy, Diagon, getCurrentPatch, makePatchRecorder, recordPatches, resetEnvironment } from '.';
import { modified } from './diagon';

import { ObjectPatch, Patch } from './types';

describe('Diagon', () => {
    describe(`${createRecordingProxy.name}()`, () => {
        let target: {
            prop0: string
            prop1: number
        };

        beforeEach(() => {
            resetEnvironment();
            clearModified();

            target = {
                prop0: 'hello',
                prop1: 42
            };
        });

        afterEach(() => {
            clearModified();
        });

        it('tracks changes', () => {
            const proxy = createRecordingProxy(target);

            expect(proxy.prop0).toEqual('hello');

            proxy.prop0 = 'foo';
            expect(proxy.prop0).toEqual('foo');
            //console.log('getPatch(target) :>> ', getPatch(target));
            expect(getCurrentPatch(target)!.get('prop0')).toEqual('hello');

            expect('prop1' in proxy).toEqual(true);
            expect(Reflect.ownKeys(target)).toContain('prop0');

            expect(proxy).toHaveProperty('prop0');
            expect(getCurrentPatch(target)!.has('prop0')).toBeTruthy();
        });
    });

    describe('change tracking', () => {
        beforeEach(() => {
            resetEnvironment();
            clearModified();
        });

        afterEach(() => {
            clearModified();
        });

        describe(`${endRecording.name}`, () => {
            it('produces no changes when there are no changes', () => {
                const previouses = endRecording();
                expect(previouses).toEqual([]);
            });

            it('produces changes for primitive property changes', () => {
                const target = {
                    name: 'Bob'
                } as any;

                const proxy = createRecordingProxy(target);

                const initialChanges = endRecording();
                expect(initialChanges).toHaveLength(0);
                expect(modified.size).toEqual(0);

                proxy.name = 'Steve';
                const changes = endRecording();
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
                endRecording();
                proxy.referencedObject = otherObject;

                const patches = endRecording();

                expect(patches).toHaveLength(1);

                expect(target.referencedObject).toEqual(otherObject);
                const patchFromChange = createReversePatch(patches[0]) as ObjectPatch<typeof target>;

                expect(patchFromChange.get('referencedObject')).toEqual(otherObject);
            });
        });
    });

    describe(`${recordPatches.name}()`, () => {
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

            const changes = recordPatches(state, changeName, 'Walker');

            expect(state).toBe(referenceToOriginalNonProxyState);
            expect(state.name).toEqual('Walker');

            expect(Diagon.currentContext).toBeUndefined();
            expect(changes).toHaveLength(1);
            expect((changes[0] as ObjectPatch<State>).get('name')).toEqual('Jones');
        });

        it('records changes over multiple calls', () => {
            const state = { name: 'Jones', age: 1231 };
            type State = typeof state;
            const changeName = makePatchRecorder((state: State, newName: string) => {
                state.name = newName;
            });

            const changeHistory: Array<Array<Patch>> = [];

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
