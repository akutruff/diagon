/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable jest/no-disabled-tests */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { clearContext, commitDeltas, createContext, createRecordingProxy, tryGetProxy, asOriginal, isProxy, recordDeltas, resetEnvironment } from './dimmer';

import { findAllDeltasInHistory, removeDimmerMetadata, cloneDeep, undoDelta, createReverseDelta } from './history';
import { DIMMER_ID, Delta, NO_ENTRY } from './types';

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
            const history: Delta[][] = [];

            history.push(recordDeltas((state) => state.root = createNode(0), state));  //state change
            history.push(recordDeltas((state) => state.root!.child = createNode(2), state)); // root change
            history.push(recordDeltas((state) => state.root!.child = createNode(3), state)); // root change

            const stateDeltas = findAllDeltasInHistory(history, state);
            expect(stateDeltas[0].get('root')).toBeUndefined();
            expect(stateDeltas).toHaveLength(1);

            const rootDeltas = findAllDeltasInHistory(history, state.root);

            expect(rootDeltas).toHaveLength(2);

            expect(rootDeltas[0]).toEqual(new Map([['child', undefined]]));
            expect(rootDeltas[1]).toEqual(new Map([['child', { data: 2, child: undefined }]]));
            // expect(rootDeltas[1]).toEqual({ child: { data: 2, child: undefined } });
        });

        it('records history with circular references', () => {
            const state = createRecordingProxy({ root: createNode(0) });
            const history: Delta[][] = [];

            history.push(recordDeltas((state) => state.root!.child = state.root, state)); // root change
            history.push(recordDeltas((state) => state.root!.child!.child = state.root, state)); // root change

            const rootDeltas = findAllDeltasInHistory(history, state.root);
            expect(rootDeltas).toHaveLength(2);

            expect(rootDeltas[0]).toEqual(new Map([['child', undefined]]));
            expect(rootDeltas[1].get('child')).toBe(state.root);
        });

    });

    describe(`${undoDelta.name}()`, () => {
        describe('proxy behavior', () => {
            beforeEach(() => {
                createContext();
            });

            afterEach(() => {
                clearContext();
            });

            it('supports a series of value changes', () => {
                const target = {
                    name: '0'
                };
                const targetProxy = createRecordingProxy(target);
                const changes: Delta[][] = [];

                clearContext();
                const changeCount = 10;

                for (let i = 0; i < changeCount; i++) {
                    createContext(); {
                        targetProxy.name = i.toString();
                        const newPatches = commitDeltas();
                        changes.push(newPatches);
                    }
                    clearContext();
                }

                for (let i = changes.length - 1; i >= 0; i--) {
                    expect(target.name).toEqual(i.toString());
                    changes[i].forEach(undoDelta);
                }

                expect(target.name).toEqual('0');
            });
        });

        describe('collections', () => {
            it('undoes changes to maps', () => {
                const target = new Map<string, number>();

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.set('foo', 123), target));
                history.push(recordDeltas(target => target.set('foo', 821), target));
                history.push(recordDeltas(target => target.delete('foo'), target));
                history.push(recordDeltas(target => target.set('foo', 1231), target));

                const deltas = findAllDeltasInHistory(history, target);

                expect(deltas).toHaveLength(4);

                expect(deltas[0].get('foo')).toEqual(NO_ENTRY);
                expect(deltas[1].get('foo')).toEqual(123);
                expect(deltas[2].get('foo')).toEqual(821);
                expect(deltas[3].get('foo')).toEqual(NO_ENTRY);

                expect(target.get('foo')).toEqual(1231);
                undoDelta(deltas[3]);
                expect(target.has('foo')).toBeFalsy();
                undoDelta(deltas[2]);
                expect(target.get('foo')).toEqual(821);
                undoDelta(deltas[1]);
                expect(target.get('foo')).toEqual(123);
                undoDelta(deltas[0]);
                expect(target.has('foo')).toBeFalsy();
            });

            it('undoes changes to sets', () => {
                const target = new Set<string>();

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.add('foo'), target));
                history.push(recordDeltas(target => target.add('bar'), target));
                history.push(recordDeltas(target => target.delete('foo'), target));
                history.push(recordDeltas(target => target.add('foo'), target));

                const deltas = findAllDeltasInHistory(history, target);

                expect(deltas).toHaveLength(4);

                expect(deltas[0].get('foo')).toEqual(false);

                expect(deltas[1].get('foo')).toEqual(undefined); //No change should exist for 'foo'                
                expect(deltas[1].get('bar')).toEqual(false);

                expect(deltas[2].get('foo')).toEqual(true);
                expect(deltas[3].get('foo')).toEqual(false);

                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(true);
                undoDelta(deltas[3]);
                expect(target.has('foo')).toEqual(false);
                expect(target.has('bar')).toEqual(true);
                undoDelta(deltas[2]);
                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(true);
                undoDelta(deltas[1]);
                expect(target.has('foo')).toEqual(true);
                expect(target.has('bar')).toEqual(false);
                undoDelta(deltas[0]);
                expect(target.has('foo')).toEqual(false);
                expect(target.has('bar')).toEqual(false);
            });

            it('undoes changes to arrays', () => {
                const target: string[] = [];

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.push('foo'), target));
                history.push(recordDeltas(target => target.push('bar'), target));
                history.push(recordDeltas(target => { target.push('baz'); target.push('buzz'); }, target));
                history.push(recordDeltas(target => target.splice(1, 1), target));
                history.push(recordDeltas(target => target[1] = 'hello', target));

                const deltas = findAllDeltasInHistory(history, target);

                expect(deltas).toHaveLength(5);

                expect(deltas[0]).toEqual([]);
                expect(deltas[1]).toEqual(['foo']);
                expect(deltas[2]).toEqual(['foo', 'bar']);
                expect(deltas[3]).toEqual(['foo', 'bar', 'baz', 'buzz']);

                expect(deltas[4]).toEqual(['foo', 'baz', 'buzz']);

                expect(target).toEqual(['foo', 'hello', 'buzz']);
                undoDelta(deltas[4]);

                expect(target).toEqual(['foo', 'baz', 'buzz']);
                undoDelta(deltas[3]);

                expect(target).toEqual(['foo', 'bar', 'baz', 'buzz']);
                undoDelta(deltas[2]);

                expect(target).toEqual(['foo', 'bar']);
                undoDelta(deltas[1]);

                expect(target).toEqual(['foo']);
                undoDelta(deltas[0]);

                expect(target).toEqual([]);
            });

            it('when mutating, map uses original key whether proxy or original', () => {
                const originalState = createTestObjectGraph();

                const key = { data: 'mapKey0' };
                const value = { data: 'mapValue0' };
                const mapEntry = [[key, value]];

                const keyProxy = createRecordingProxy(key);
                const valueProxy = createRecordingProxy(value);

                recordDeltas(state => state.map = new Map([[keyProxy, valueProxy]]), originalState);

                expect(isProxy(originalState.map)).toEqual(false);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                const history: Delta[][] = [];

                history.push(recordDeltas(state => state.map.set(key, value), originalState));
                expect(originalState.map.size).toEqual(1);

                //Map should still be indexed by the proxy object.
                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                undoDelta(history[0][0]);

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

                recordDeltas(state => state.map = new Map([[keyProxy, valueProxy]]), originalState);

                expect(isProxy(originalState.map)).toEqual(false);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                const history: Delta[][] = [];

                history.push(recordDeltas(state => state.map.set(key, value), originalState));

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                history.push(recordDeltas(state => {
                    state.map.set(keyProxy, value);
                    state.map.delete(key);
                }, originalState));

                expect(originalState.map.size).toEqual(0);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBeUndefined();

                undoDelta(history[1][0]);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(value);

                undoDelta(history[0][0]);

                expect(originalState.map.get(key)).toBeUndefined();
                expect(originalState.map.get(keyProxy)).toBe(valueProxy);

                expect(originalState.map.size).toEqual(1);
            });
        });

        describe(`${createReverseDelta.name}()`, () => {
            it('will reverse changes to objects', () => {
                const target: { prop0?: string } = {};

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.prop0 = 'hello', target));
                history.push(recordDeltas(target => target.prop0 = undefined, target));
                history.push(recordDeltas(target => target.prop0 = 'again', target));

                const deltas = findAllDeltasInHistory(history, target);
                expect(deltas).toHaveLength(3);

                const reverseDeltas: Delta[] = [];

                expect(target).toEqual({ prop0: 'again' });
                reverseDeltas.unshift(createReverseDelta(deltas[2]));
                undoDelta(deltas[2]);

                reverseDeltas.unshift(createReverseDelta(deltas[1]));
                undoDelta(deltas[1]);

                reverseDeltas.unshift(createReverseDelta(deltas[0]));
                undoDelta(deltas[0]);

                expect(target).toEqual({});

                undoDelta(reverseDeltas[0]);
                expect(target).toEqual({ prop0: 'hello' });

                undoDelta(reverseDeltas[1]);
                expect(target).toEqual({ prop0: undefined });

                undoDelta(reverseDeltas[2]);
                expect(target).toEqual({ prop0: 'again' });
            });

            it('Will reverse changes to maps', () => {
                const target = new Map<string, number>();

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.set('foo', 123), target));
                history.push(recordDeltas(target => target.set('bar', 821), target));
                history.push(recordDeltas(target => target.delete('foo'), target));
                history.push(recordDeltas(target => target.set('foo', 567), target));

                const deltas = findAllDeltasInHistory(history, target);
                expect(deltas).toHaveLength(4);

                const reverseDeltas: Delta[] = [];

                expect(target).toEqual(new Map([['foo', 567], ['bar', 821]]));

                reverseDeltas.unshift(createReverseDelta(deltas[3]));
                undoDelta(deltas[3]);

                reverseDeltas.unshift(createReverseDelta(deltas[2]));
                undoDelta(deltas[2]);

                reverseDeltas.unshift(createReverseDelta(deltas[1]));
                undoDelta(deltas[1]);

                reverseDeltas.unshift(createReverseDelta(deltas[0]));
                undoDelta(deltas[0]);

                expect(target).toEqual(new Map());

                undoDelta(reverseDeltas[0]);
                expect(target).toEqual(new Map([['foo', 123]]));

                undoDelta(reverseDeltas[1]);
                expect(target).toEqual(new Map([['foo', 123], ['bar', 821]]));

                undoDelta(reverseDeltas[2]);
                expect(target).toEqual(new Map([['bar', 821]]));

                undoDelta(reverseDeltas[3]);
                expect(target).toEqual(new Map([['foo', 567], ['bar', 821]]));
            });

            it('Will reverse changes to sets', () => {
                const target = new Set<string>();

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.add('foo'), target));
                history.push(recordDeltas(target => target.add('bar'), target));
                history.push(recordDeltas(target => target.delete('foo'), target));
                history.push(recordDeltas(target => target.add('foo'), target));

                const deltas = findAllDeltasInHistory(history, target);

                expect(deltas).toHaveLength(4);

                const reverseDeltas: Delta[] = [];

                expect(target).toEqual(new Set(['foo', 'bar']));

                reverseDeltas.unshift(createReverseDelta(deltas[3]));
                undoDelta(deltas[3]);

                reverseDeltas.unshift(createReverseDelta(deltas[2]));
                undoDelta(deltas[2]);

                reverseDeltas.unshift(createReverseDelta(deltas[1]));
                undoDelta(deltas[1]);

                reverseDeltas.unshift(createReverseDelta(deltas[0]));
                undoDelta(deltas[0]);

                expect(target).toEqual(new Set());

                undoDelta(reverseDeltas[0]);
                expect(target).toEqual(new Set(['foo']));

                undoDelta(reverseDeltas[1]);
                expect(target).toEqual(new Set(['foo', 'bar']));

                undoDelta(reverseDeltas[2]);
                expect(target).toEqual(new Set(['bar']));

                undoDelta(reverseDeltas[3]);
                expect(target).toEqual(new Set(['foo', 'bar']));
            });

            it('Will reverse changes to arrays', () => {
                const target: string[] = [];

                const history: Delta[][] = [];

                history.push(recordDeltas(target => target.push('foo'), target));
                history.push(recordDeltas(target => target.push('bar'), target));
                history.push(recordDeltas(target => { target.push('baz'); target.push('buzz'); }, target));
                history.push(recordDeltas(target => target.splice(1, 1), target));
                history.push(recordDeltas(target => target[1] = 'hello', target));

                const deltas = findAllDeltasInHistory(history, target);

                expect(deltas).toHaveLength(5);

                const reverseDeltas: Delta[] = [];

                reverseDeltas.unshift(createReverseDelta(deltas[4]));
                undoDelta(deltas[4]);

                reverseDeltas.unshift(createReverseDelta(deltas[3]));
                undoDelta(deltas[3]);

                reverseDeltas.unshift(createReverseDelta(deltas[2]));
                undoDelta(deltas[2]);

                reverseDeltas.unshift(createReverseDelta(deltas[1]));
                undoDelta(deltas[1]);

                reverseDeltas.unshift(createReverseDelta(deltas[0]));
                undoDelta(deltas[0]);

                expect(target).toEqual([]);

                undoDelta(reverseDeltas[0]);
                expect(target).toEqual(['foo']);

                undoDelta(reverseDeltas[1]);
                expect(target).toEqual(['foo', 'bar']);

                undoDelta(reverseDeltas[2]);
                expect(target).toEqual(['foo', 'bar', 'baz', 'buzz']);

                undoDelta(reverseDeltas[3]);
                expect(target).toEqual(['foo', 'baz', 'buzz']);

                undoDelta(reverseDeltas[4]);
                expect(target).toEqual(['foo', 'hello', 'buzz']);
            });
        });
    });


    describe('cloneDeep', () => {
        it('assigns dimmer id to source objects', () => {
            const state = { root: { data: 1 } };

            const result = cloneDeep(state);
            expect((state as any)[DIMMER_ID]).toBeDefined();
            expect((state as any)[DIMMER_ID]).toEqual(0);

            expect((result as any)[DIMMER_ID]).toBeDefined();
            expect((result as any)[DIMMER_ID]).toEqual(0);

            expect((state.root as any)[DIMMER_ID]).toBeDefined();
            expect((state.root as any)[DIMMER_ID]).toEqual(1);
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

        describe(`${removeDimmerMetadata.name}()`, () => {
            it('removes dimmer properties on original objects', () => {
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
            it.todo('create a ProxifyHierarchy() methoid');
        });
    });
});
