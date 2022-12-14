/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { clearModified, endRecording, createRecordingProxy, tryGetProxy, asOriginal, isProxy, recordPatches, resetEnvironment } from './diagon';
import { findAllPatchesInHistory, removeDiagonMetadata, cloneDeep, applyPatch, createReversePatch } from './history';
import { DIAGON_ID, Patch, NO_ENTRY } from './types';

describe('History', () => {
    interface StringNode {
        data: string;
        child?: StringNode;
    }

    function createTestObjectGraph() {
        return {
            root: { data: 'root', child: { data: 'rootChild' } },
            map: new Map<StringNode, StringNode>([[{ data: 'mapKey0' }, { data: 'mapValue0' }], [{ data: 'mapKey1' }, { data: 'mapValue1' }]]),
            set: new Set<StringNode>([{ data: 'setValue0' }, { data: 'setValue1' },]),
            array: [{ data: 'arrayValue0' }, { data: 'arrayValue1' }]
        };
    }

    interface Node {
        data: number;
        child?: Node;
    }

    function createNode(data: number, child?: Node): Node {
        return { data, child };
    }

    beforeEach(() => {
        resetEnvironment();
    });

    describe('object graph support', () => {


        it('records history with child references', () => {
            const state: { root?: Node } = createRecordingProxy({});
            const history: Patch[][] = [];

            history.push(recordPatches(state, (state) => state.root = createNode(0)));  //state change
            history.push(recordPatches(state, (state) => state.root!.child = createNode(2))); // root change
            history.push(recordPatches(state, (state) => state.root!.child = createNode(3))); // root change

            const statePatches = findAllPatchesInHistory(history, state);
            expect(statePatches[0].get('root')).toBeUndefined();
            expect(statePatches).toHaveLength(1);

            const rootPatches = findAllPatchesInHistory(history, state.root);

            expect(rootPatches).toHaveLength(2);

            expect(rootPatches[0]).toEqual(new Map([['child', undefined]]));
            expect(rootPatches[1]).toEqual(new Map([['child', { data: 2, child: undefined }]]));
            // expect(rootPatches[1]).toEqual({ child: { data: 2, child: undefined } });
        });

        it('records history with circular references', () => {
            const state = createRecordingProxy({ root: createNode(0) });
            const history: Patch[][] = [];

            history.push(recordPatches(state, (state) => state.root!.child = state.root)); // root change
            history.push(recordPatches(state, (state) => state.root!.child!.child = state.root)); // root change

            const rootPatches = findAllPatchesInHistory(history, state.root);
            expect(rootPatches).toHaveLength(2);

            expect(rootPatches[0]).toEqual(new Map([['child', undefined]]));
            expect(rootPatches[1].get('child')).toBe(state.root);
        });

    });

    describe(`${applyPatch.name}()`, () => {
        describe('proxy behavior', () => {
            beforeEach(() => {
                clearModified();
            });

            afterEach(() => {
                clearModified();
            });

            it('supports a series of value changes', () => {
                const target = {
                    name: '0'
                };
                const targetProxy = createRecordingProxy(target);
                const changes: Patch[][] = [];

                clearModified();
                const changeCount = 10;

                for (let i = 0; i < changeCount; i++) {
                    clearModified(); {
                        targetProxy.name = i.toString();
                        const newPatches = endRecording();
                        changes.push(newPatches);
                    }
                    clearModified();
                }

                for (let i = changes.length - 1; i >= 0; i--) {
                    expect(target.name).toEqual(i.toString());
                    changes[i].forEach(applyPatch);
                }

                expect(target.name).toEqual('0');
            });
        });

        describe('collections', () => {
            it('undoes changes to maps', () => {
                const target = new Map<string, number>();

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.set('foo', 123)));
                history.push(recordPatches(target, target => target.set('foo', 821)));
                history.push(recordPatches(target, target => target.delete('foo')));
                history.push(recordPatches(target, target => target.set('foo', 1231)));

                const patches = findAllPatchesInHistory(history, target);

                expect(patches).toHaveLength(4);

                expect(patches[0].get('foo')).toEqual(NO_ENTRY);
                expect(patches[1].get('foo')).toEqual(123);
                expect(patches[2].get('foo')).toEqual(821);
                expect(patches[3].get('foo')).toEqual(NO_ENTRY);

                expect(target.get('foo')).toEqual(1231);
                applyPatch(patches[3]);
                expect(target.has('foo')).toBeFalsy();
                applyPatch(patches[2]);
                expect(target.get('foo')).toEqual(821);
                applyPatch(patches[1]);
                expect(target.get('foo')).toEqual(123);
                applyPatch(patches[0]);
                expect(target.has('foo')).toBeFalsy();
            });

            it('undoes changes to sets', () => {
                const target = new Set<string>();

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.add('foo')));
                history.push(recordPatches(target, target => target.add('bar')));
                history.push(recordPatches(target, target => target.delete('foo')));
                history.push(recordPatches(target, target => target.add('foo')));

                const patches = findAllPatchesInHistory(history, target);

                expect(patches).toHaveLength(4);

                expect(patches[0].get('foo')).toEqual(false);

                expect(patches[1].get('foo')).toEqual(undefined); //No change should exist for 'foo'                
                expect(patches[1].get('bar')).toEqual(false);

                expect(patches[2].get('foo')).toEqual(true);
                expect(patches[3].get('foo')).toEqual(false);

                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(true);
                applyPatch(patches[3]);
                expect(target.has('foo')).toEqual(false);
                expect(target.has('bar')).toEqual(true);
                applyPatch(patches[2]);
                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(true);
                applyPatch(patches[1]);
                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(false);
                applyPatch(patches[0]);
                expect(target.has('foo')).toEqual(false);
                expect(target.has('bar')).toEqual(false);
            });

            it('undoes changes to arrays', () => {
                const target: string[] = [];

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.push('foo')));
                history.push(recordPatches(target, target => target.push('bar')));
                history.push(recordPatches(target, target => { target.push('baz'); target.push('buzz'); }));
                history.push(recordPatches(target, target => target.splice(1, 1)));
                history.push(recordPatches(target, target => target[1] = 'hello'));

                const patches = findAllPatchesInHistory(history, target);

                expect(patches).toHaveLength(5);

                expect(patches[0]).toEqual([]);
                expect(patches[1]).toEqual(['foo']);
                expect(patches[2]).toEqual(['foo', 'bar']);
                expect(patches[3]).toEqual(['foo', 'bar', 'baz', 'buzz']);

                expect(patches[4]).toEqual(['foo', 'baz', 'buzz']);

                expect(target).toEqual(['foo', 'hello', 'buzz']);
                applyPatch(patches[4]);

                expect(target).toEqual(['foo', 'baz', 'buzz']);
                applyPatch(patches[3]);

                expect(target).toEqual(['foo', 'bar', 'baz', 'buzz']);
                applyPatch(patches[2]);

                expect(target).toEqual(['foo', 'bar']);
                applyPatch(patches[1]);

                expect(target).toEqual(['foo']);
                applyPatch(patches[0]);

                expect(target).toEqual([]);
            });

            it('when mutating, map uses original key whether proxy or original', () => {
                const originalState = createTestObjectGraph();

                const key = { data: 'mapKey0' };
                const value = { data: 'mapValue0' };
                const mapEntry = [[key, value]];

                const keyProxy = createRecordingProxy(key);
                const valueProxy = createRecordingProxy(value);

                recordPatches(originalState, state => state.map = new Map([[keyProxy, valueProxy]]));

                expect(isProxy(originalState.map)).toEqual(false);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                const history: Patch[][] = [];

                history.push(recordPatches(originalState, state => state.map.set(key, value)));
                expect(originalState.map.size).toEqual(1);

                //Map should still be indexed by the proxy object.
                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                applyPatch(history[0][0]);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                expect(originalState.map.size).toEqual(1);
            });

            it('when deleting, map uses original key whether proxy or original', () => {
                const originalState = createTestObjectGraph();

                const key = { data: 'mapKey0' };
                const value = { data: 'mapValue0' };

                const keyProxy = createRecordingProxy(key);
                const valueProxy = createRecordingProxy(value);

                recordPatches(originalState, state => state.map = new Map([[keyProxy, valueProxy]]));

                expect(isProxy(originalState.map)).toEqual(false);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                const history: Patch[][] = [];

                history.push(recordPatches(originalState, state => state.map.set(key, value)));

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                history.push(recordPatches(originalState, state => {
                    state.map.set(keyProxy, value);
                    state.map.delete(key);
                }));

                expect(originalState.map.size).toEqual(0);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBeUndefined();

                applyPatch(history[1][0]);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                applyPatch(history[0][0]);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                expect(originalState.map.size).toEqual(1);
            });
        });

        describe(`${createReversePatch.name}()`, () => {
            it('will reverse changes to objects', () => {
                const target: { prop0?: string } = {};

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.prop0 = 'hello'));
                history.push(recordPatches(target, target => target.prop0 = undefined));
                history.push(recordPatches(target, target => target.prop0 = 'again'));

                const patches = findAllPatchesInHistory(history, target);
                expect(patches).toHaveLength(3);

                const reversePatches: Patch[] = [];

                expect(target).toEqual({ prop0: 'again' });
                reversePatches.unshift(createReversePatch(patches[2]));
                applyPatch(patches[2]);

                reversePatches.unshift(createReversePatch(patches[1]));
                applyPatch(patches[1]);

                reversePatches.unshift(createReversePatch(patches[0]));
                applyPatch(patches[0]);

                expect(target).toEqual({});

                applyPatch(reversePatches[0]);
                expect(target).toEqual({ prop0: 'hello' });

                applyPatch(reversePatches[1]);
                expect(target).toEqual({ prop0: undefined });

                applyPatch(reversePatches[2]);
                expect(target).toEqual({ prop0: 'again' });
            });

            it('Will reverse changes to maps', () => {
                const target = new Map<string, number>();

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.set('foo', 123)));
                history.push(recordPatches(target, target => target.set('bar', 821)));
                history.push(recordPatches(target, target => target.delete('foo')));
                history.push(recordPatches(target, target => target.set('foo', 567)));

                const patches = findAllPatchesInHistory(history, target);
                expect(patches).toHaveLength(4);

                const reversePatches: Patch[] = [];

                expect(target).toEqual(new Map([['foo', 567], ['bar', 821]]));

                reversePatches.unshift(createReversePatch(patches[3]));
                applyPatch(patches[3]);

                reversePatches.unshift(createReversePatch(patches[2]));
                applyPatch(patches[2]);

                reversePatches.unshift(createReversePatch(patches[1]));
                applyPatch(patches[1]);

                reversePatches.unshift(createReversePatch(patches[0]));
                applyPatch(patches[0]);

                expect(target).toEqual(new Map());

                applyPatch(reversePatches[0]);
                expect(target).toEqual(new Map([['foo', 123]]));

                applyPatch(reversePatches[1]);
                expect(target).toEqual(new Map([['foo', 123], ['bar', 821]]));

                applyPatch(reversePatches[2]);
                expect(target).toEqual(new Map([['bar', 821]]));

                applyPatch(reversePatches[3]);
                expect(target).toEqual(new Map([['foo', 567], ['bar', 821]]));
            });

            it('Will reverse changes to sets', () => {
                const target = new Set<string>();

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.add('foo')));
                history.push(recordPatches(target, target => target.add('bar')));
                history.push(recordPatches(target, target => target.delete('foo')));
                history.push(recordPatches(target, target => target.add('foo')));

                const patches = findAllPatchesInHistory(history, target);

                expect(patches).toHaveLength(4);

                const reversePatches: Patch[] = [];

                expect(target).toEqual(new Set(['foo', 'bar']));

                reversePatches.unshift(createReversePatch(patches[3]));
                applyPatch(patches[3]);

                reversePatches.unshift(createReversePatch(patches[2]));
                applyPatch(patches[2]);

                reversePatches.unshift(createReversePatch(patches[1]));
                applyPatch(patches[1]);

                reversePatches.unshift(createReversePatch(patches[0]));
                applyPatch(patches[0]);

                expect(target).toEqual(new Set());

                applyPatch(reversePatches[0]);
                expect(target).toEqual(new Set(['foo']));

                applyPatch(reversePatches[1]);
                expect(target).toEqual(new Set(['foo', 'bar']));

                applyPatch(reversePatches[2]);
                expect(target).toEqual(new Set(['bar']));

                applyPatch(reversePatches[3]);
                expect(target).toEqual(new Set(['foo', 'bar']));
            });

            it('Will reverse changes to arrays', () => {
                const target: string[] = [];

                const history: Patch[][] = [];

                history.push(recordPatches(target, target => target.push('foo')));
                history.push(recordPatches(target, target => target.push('bar')));
                history.push(recordPatches(target, target => { target.push('baz'); target.push('buzz'); }));
                history.push(recordPatches(target, target => target.splice(1, 1)));
                history.push(recordPatches(target, target => target[1] = 'hello'));

                const patches = findAllPatchesInHistory(history, target);

                expect(patches).toHaveLength(5);

                const reversePatches: Patch[] = [];

                reversePatches.unshift(createReversePatch(patches[4]));
                applyPatch(patches[4]);

                reversePatches.unshift(createReversePatch(patches[3]));
                applyPatch(patches[3]);

                reversePatches.unshift(createReversePatch(patches[2]));
                applyPatch(patches[2]);

                reversePatches.unshift(createReversePatch(patches[1]));
                applyPatch(patches[1]);

                reversePatches.unshift(createReversePatch(patches[0]));
                applyPatch(patches[0]);

                expect(target).toEqual([]);

                applyPatch(reversePatches[0]);
                expect(target).toEqual(['foo']);

                applyPatch(reversePatches[1]);
                expect(target).toEqual(['foo', 'bar']);

                applyPatch(reversePatches[2]);
                expect(target).toEqual(['foo', 'bar', 'baz', 'buzz']);

                applyPatch(reversePatches[3]);
                expect(target).toEqual(['foo', 'baz', 'buzz']);

                applyPatch(reversePatches[4]);
                expect(target).toEqual(['foo', 'hello', 'buzz']);
            });
        });
    });

    describe('cloneDeep', () => {
        it('assigns diagon id to source objects', () => {
            const state = { root: { data: 1 } };

            const result = cloneDeep(state);
            expect((state as any)[DIAGON_ID]).toBeDefined();
            expect((state as any)[DIAGON_ID]).toEqual(0);

            expect((result as any)[DIAGON_ID]).toBeDefined();
            expect((result as any)[DIAGON_ID]).toEqual(0);

            expect((state.root as any)[DIAGON_ID]).toBeDefined();
            expect((state.root as any)[DIAGON_ID]).toEqual(1);
        });

        it('works with jest with circular references', () => {
            const state: { root: Node } = { root: { data: 1 } };

            state.root.child = state.root;

            const clone = cloneDeep(state);

            expect(clone).toEqual(state);
            expect(clone).not.toBe(state);
            expect(clone.root).toBeDefined();
            expect(clone.root).not.toBe(state.root);
            expect(clone.root.child).not.toBe(state.root.child);
            expect(clone.root.child).not.toBe(state.root.child);
            expect(clone.root.child).toEqual(state.root.child);
            expect(clone.root.child).toBe(clone.root);
        });

        it('two clones are equal', () => {
            const state = { root: { data: 1 } };

            const clone0 = cloneDeep(state);
            const clone1 = cloneDeep(state);

            expect(clone0).toEqual(clone1);
            expect(clone0).not.toBe(clone1);
        });

        it('works with arrays', () => {
            const state: { root?: Node, someNodes: Node[] } = { someNodes: [] };
            state.someNodes.push(state.root!);

            const clone = cloneDeep(state);

            expect(clone).toEqual(state);
            expect(asOriginal(clone)).not.toBe(asOriginal(state));

        });

        it('works with jest with circular references on proxies', () => {
            const originalState: { root: Node } = { root: { data: 1 } };
            const state = createRecordingProxy(originalState);

            state.root.child = state.root;

            const clone = cloneDeep(state);

            expect(clone).toEqual(cloneDeep(originalState));
        });

        describe(`${removeDiagonMetadata.name}()`, () => {
            it('removes diagon properties on original objects', () => {
                const originalState = createTestObjectGraph();
                const state = createRecordingProxy(originalState);
                //make hierarichy proxied
                state.root = state.root;
                state.root.child = state.root.child;

                state.map = state.map;
                expect(isProxy(state.map)).toBeTruthy();
                expect(tryGetProxy(originalState.map)).toBeTruthy();
                for (const [key, value] of state.map) {
                    key.data = key.data;
                    value.data = value.data;
                    expect(tryGetProxy(value)).toBeTruthy();
                    expect(tryGetProxy(key)).toBeTruthy();
                }
            });
            it.todo('create a ProxifyHierarchy() method');
        });
    });
});
