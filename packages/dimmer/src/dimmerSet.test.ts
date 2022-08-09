import { DimmerSet } from './dimmerSet';
import { clearContext, createRecordingProxy, asOriginal, isProxy, recordDeltas, resetEnvironment, deltaToTarget } from './dimmer';
import {  ORIGINAL, PROXY } from './types';
import { getObjectTimeline } from './history';

describe('DimmerSet', () => {
    type Node = { prop0: string };

    function createTestEntries() {
        const entries: Node[] = [{ prop0: 'value0' }, { prop0: 'value1' }];

        return entries;
    }

    beforeEach(() => {
        resetEnvironment();
    });

    it('can be constructed', () => {
        const dimmerSet = new DimmerSet<string>(new Set());
        expect(dimmerSet).toBeDefined();
        expect(dimmerSet).toBeInstanceOf(Set);
    });

    describe('has()', () => {
        describe('mixed use of object-typed keys', () => {
            it('retrieves value when initialized with original as key and then fetched with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const dimmerSet = new DimmerSet<typeof value>(target);
                expect(dimmerSet.has(valueProxy)).toEqual(true);
                expect(dimmerSet.size).toEqual(1);

                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);
            });

            it('retrieves value when initialized with proxy as key and then fetched with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const dimmerSet = new DimmerSet<typeof value>(target);
                expect(dimmerSet.has(value)).toEqual(true);
                expect(dimmerSet.size).toEqual(1);

                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);
            });
        });
    });

    describe('add()', () => {
        it(`records false for newly added entries.`, () => {
            const target = new Set<string>();

            const dimmerSet = new DimmerSet<string>(target);
            dimmerSet.add('foo');

            expect(dimmerSet.currentDelta.get('foo')).toEqual(false);
            expect(dimmerSet.has('foo')).toEqual(true);
            expect(target.has('foo')).toEqual(true);
        });

        it('does not record change if value already in set.', () => {
            const target = new Set<string>();
            target.add('foo');
            const dimmerSet = new DimmerSet<string>(target);
            dimmerSet.add('foo');

            expect(dimmerSet.size).toEqual(1);

            expect(dimmerSet.currentDelta.has('foo')).toEqual(false);
            expect(dimmerSet.has('foo')).toEqual(true);
            expect(target.has('foo')).toEqual(true);
        });

        describe('mixing proxies and originals as values', () => {
            it('keeps proxy as stored value when initialized with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const dimmerSet = new DimmerSet<typeof value>(target);
                dimmerSet.add(value);

                expect(dimmerSet.has(value)).toEqual(true);
                expect(dimmerSet.has(valueProxy)).toEqual(true);
                expect(dimmerSet.size).toEqual(1);

                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);
                expect(dimmerSet.currentDelta.get(valueProxy)).toEqual(undefined);


                expect(target.has(valueProxy)).toEqual(true);
            });

            it('keeps original as stored value when initialized with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const dimmerSet = new DimmerSet<typeof value>(target);
                dimmerSet.add(valueProxy);

                expect(dimmerSet.has(value)).toEqual(true);
                expect(dimmerSet.has(valueProxy)).toEqual(true);
                expect(dimmerSet.size).toEqual(1);

                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);
                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);

                expect(target.has(value)).toEqual(true);
            });
        });
    });

    describe('delete()', () => {
        it(`records nothing if did not previously have value.`, () => {
            const target = new Set<string>();

            const dimmerSet = new DimmerSet<string>(target);
            dimmerSet.delete('foo');

            expect(dimmerSet.currentDelta.has('foo')).toEqual(false);
            expect(dimmerSet.has('foo')).toEqual(false);
        });

        it('records previous value when present.', () => {
            const target = new Set<string>();
            target.add('foo');
            const dimmerSet = new DimmerSet<string>(target);

            dimmerSet.delete('foo');

            expect(dimmerSet.currentDelta.get('foo')).toEqual(true);
            expect(dimmerSet.has('foo')).toEqual(false);
        });

        describe('mixing proxies and originals as values', () => {
            it('marks original as value previously stored when initialized with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const dimmerSet = new DimmerSet<typeof value>(target);
                dimmerSet.delete(valueProxy);

                expect(dimmerSet.has(value)).toEqual(false);
                expect(dimmerSet.has(valueProxy)).toEqual(false);
                expect(dimmerSet.size).toEqual(0);

                expect(dimmerSet.currentDelta.get(value)).toEqual(true);
                expect(dimmerSet.currentDelta.get(valueProxy)).toEqual(undefined);

                expect(target.has(value)).toEqual(false);
                expect(target.has(valueProxy)).toEqual(false);
            });

            it('marks proxy as value previously stored when initialized with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const dimmerSet = new DimmerSet<typeof value>(target);
                dimmerSet.delete(value);

                expect(dimmerSet.has(value)).toEqual(false);
                expect(dimmerSet.has(valueProxy)).toEqual(false);
                expect(dimmerSet.size).toEqual(0);

                expect(dimmerSet.currentDelta.get(value)).toEqual(undefined);
                expect(dimmerSet.currentDelta.get(valueProxy)).toEqual(true);

                expect(target.has(value)).toEqual(false);
                expect(target.has(valueProxy)).toEqual(false);
            });
        });
    });

    describe(`[${ORIGINAL.description}]`, () => {
        it(`returns target.`, () => {
            const target = new Set<string>();

            const dimmerSet = new DimmerSet<string>(target);
            expect(dimmerSet[ORIGINAL]).toBe(target);
        });
    });

    describe(`[${PROXY.description}]`, () => {
        it(`returns dimmer map for both target and dimmer map target.`, () => {
            const target = new Set<string>();

            const dimmerSet = new DimmerSet<string>(target);
            expect((target as any)[PROXY]).toBe(dimmerSet);
            expect(dimmerSet[PROXY]).toBe(dimmerSet);
        });
    });

    describe('clear()', () => {
        it('records previous value when present.', () => {
            const target = new Set<string>();
            target.add('foo');
            target.add('bar');
            target.add('bob');

            const dimmerSet = new DimmerSet<string>(target);

            dimmerSet.clear();

            expect(dimmerSet.currentDelta.get('foo')).toEqual(true);
            expect(dimmerSet.currentDelta.get('bar')).toEqual(true);
            expect(dimmerSet.currentDelta.get('bob')).toEqual(true);

            expect(dimmerSet.has('foo')).toEqual(false);
            expect(dimmerSet.has('bar')).toEqual(false);
            expect(dimmerSet.has('bob')).toEqual(false);
        });
    });

    describe('foreach()', () => {
        it('returns proxies of values', () => {
            const target = new Set<Record<string, unknown>>();
            const valueObject0 = { prop0: 'foo' };
            const valueObject1 = { prop0: 'bar' };

            const dimmerSet = new DimmerSet<Record<string, unknown>>(target);
            dimmerSet.add(valueObject0);
            dimmerSet.add(valueObject1);

            let iterationCount = 0;
            dimmerSet.forEach((value, key) => {
                iterationCount++;

                expect(isProxy(value)).toBeTruthy();

                switch (asOriginal(key)) {
                    case asOriginal(valueObject0):
                    case asOriginal(valueObject1):
                        break;
                    default:
                        throw new Error('unexpected key');
                }
            });

            expect(iterationCount).toEqual(2);
        });
    });

    describe('referencing behavior', () => {
        it('works with either originals or proxies', () => {
            const entries = createTestEntries();
            const entry0Proxy = createRecordingProxy(entries[0]);

            const target = new Set(entries);
            const dimmerSet = new DimmerSet(target);

            expect(dimmerSet.has(entries[0])).toEqual(true);
            expect(dimmerSet.has(entry0Proxy)).toEqual(true);
        });

    });

    describe('iteration', () => {
        beforeEach(() => {
            resetEnvironment();
        });

        describe('values()', () => {
            it('returns proxiedKeys', () => {
                const entries = createTestEntries();

                const target = new Set(entries);
                const dimmerSet = new DimmerSet(target);

                let i = 0;
                for (const value of dimmerSet.values()) {
                    expect(isProxy(value)).toEqual(true);
                    expect(asOriginal(value)).toBe(entries[i]);
                    i++;
                }
                expect(i).toEqual(2);
            });
        });

        describe('entries()', () => {
            it('returns proxiedKeys', () => {
                const entries = createTestEntries();

                const target = new Set(entries);
                const dimmerMap = new DimmerSet(target);

                let i = 0;
                for (const [value0, value1] of dimmerMap.entries()) {
                    expect(isProxy(value0)).toEqual(true);
                    expect(asOriginal(value0)).toBe(entries[i]);

                    expect(isProxy(value1)).toEqual(true);
                    expect(asOriginal(value1)).toBe(entries[i]);
                    expect(value0).toBe(value1);

                    i++;
                }

                expect(i).toEqual(2);
            });
        });
    });

    describe('commitChanges()', () => {
        beforeEach(() => {
            resetEnvironment();
        });

        afterEach(() => {
            clearContext();
        });

        it('returns map of differences and clears dimmer map', () => {
            const target = new Set<string>();

            const dimmerSet = new DimmerSet<string>(target);
            dimmerSet.add('fooo');

            expect(dimmerSet.currentDelta.size).toEqual(1);

            const previous = dimmerSet.commitDelta();

            expect(deltaToTarget.get(previous)).toBe(target);
            expect(dimmerSet.size).toEqual(1);
            expect(dimmerSet.currentDelta.size).toEqual(0);
        });

    });

    describe('as part of an object proxy', () => {
        beforeEach(() => {
            resetEnvironment();
        });

        afterEach(() => {
            clearContext();
        });

        it('proxies when child property', () => {
            const underlyingSet = new Set<string>();
            const state = { name: 'bob', setProp: underlyingSet };
            type State = typeof state;

            const history = [];
            history.push(recordDeltas((state: State) => state.setProp.add('fdfd'), state));
            expect((underlyingSet as any)[PROXY]).toBeDefined();

            let timeline = getObjectTimeline(history, underlyingSet);

            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));

            history.push(recordDeltas((state: State) => state.setProp.add('bob'), state));

            timeline = getObjectTimeline(history, underlyingSet);

            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));
            expect(timeline[1][1]).toEqual(new Map([['bob', false]]));
        });

        it('records history', () => {
            const state = new Set<string>();
            type State = typeof state;

            const history = [];
            history.push(recordDeltas((state: State) => state.add('fdfd'), state));

            let timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));

            history.push(recordDeltas((state: State) => state.add('bob'), state));

            timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));
            expect(timeline[1][1]).toEqual(new Map([['bob', false]]));

            history.push(recordDeltas((state: State) => state.delete('fdfd'), state));

            timeline = getObjectTimeline(history, state);
            expect(timeline[2][1]).toEqual(new Map([['fdfd', true]]));
        });
    });
});