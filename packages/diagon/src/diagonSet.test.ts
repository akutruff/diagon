import { DiagonSet } from './diagonSet';
import { clearModified, createRecordingProxy, asOriginal, isProxy, recordPatches, resetEnvironment, patchToSource, tryGetProxy } from './diagon';
import { ORIGINAL } from './types';
import { getObjectTimeline } from './history';

describe('DiagonSet', () => {
    type Node = { prop0: string };

    function createTestEntries() {
        const entries: Node[] = [{ prop0: 'value0' }, { prop0: 'value1' }];

        return entries;
    }

    beforeEach(() => {
        resetEnvironment();
    });

    it('can be constructed', () => {
        const diagonSet = new DiagonSet<string>(new Set());
        expect(diagonSet).toBeDefined();
        expect(diagonSet).toBeInstanceOf(Set);
    });

    describe('has()', () => {
        describe('mixed use of object-typed keys', () => {
            it('retrieves value when initialized with original as key and then fetched with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const diagonSet = new DiagonSet<typeof value>(target);
                expect(diagonSet.has(valueProxy)).toEqual(true);
                expect(diagonSet.size).toEqual(1);

                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);
            });

            it('retrieves value when initialized with proxy as key and then fetched with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const diagonSet = new DiagonSet<typeof value>(target);
                expect(diagonSet.has(value)).toEqual(true);
                expect(diagonSet.size).toEqual(1);

                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);
            });
        });
    });

    describe('add()', () => {
        it(`records false for newly added entries.`, () => {
            const target = new Set<string>();

            const diagonSet = new DiagonSet<string>(target);
            diagonSet.add('foo');

            expect(diagonSet.currentPatch.get('foo')).toEqual(false);
            expect(diagonSet.has('foo')).toEqual(true);
            expect(target.has('foo')).toEqual(true);
        });

        it('does not record change if value already in set.', () => {
            const target = new Set<string>();
            target.add('foo');
            const diagonSet = new DiagonSet<string>(target);
            diagonSet.add('foo');

            expect(diagonSet.size).toEqual(1);

            expect(diagonSet.currentPatch.has('foo')).toEqual(false);
            expect(diagonSet.has('foo')).toEqual(true);
            expect(target.has('foo')).toEqual(true);
        });

        describe('mixing proxies and originals as values', () => {
            it('keeps proxy as stored value when initialized with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const diagonSet = new DiagonSet<typeof value>(target);
                diagonSet.add(value);

                expect(diagonSet.has(value)).toEqual(true);
                expect(diagonSet.has(valueProxy)).toEqual(true);
                expect(diagonSet.size).toEqual(1);

                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);
                expect(diagonSet.currentPatch.get(valueProxy)).toEqual(undefined);


                expect(target.has(valueProxy)).toEqual(true);
            });

            it('keeps original as stored value when initialized with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const diagonSet = new DiagonSet<typeof value>(target);
                diagonSet.add(valueProxy);

                expect(diagonSet.has(value)).toEqual(true);
                expect(diagonSet.has(valueProxy)).toEqual(true);
                expect(diagonSet.size).toEqual(1);

                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);
                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);

                expect(target.has(value)).toEqual(true);
            });
        });
    });

    describe('delete()', () => {
        it(`records nothing if did not previously have value.`, () => {
            const target = new Set<string>();

            const diagonSet = new DiagonSet<string>(target);
            diagonSet.delete('foo');

            expect(diagonSet.currentPatch.has('foo')).toEqual(false);
            expect(diagonSet.has('foo')).toEqual(false);
        });

        it('records previous value when present.', () => {
            const target = new Set<string>();
            target.add('foo');
            const diagonSet = new DiagonSet<string>(target);

            diagonSet.delete('foo');

            expect(diagonSet.currentPatch.get('foo')).toEqual(true);
            expect(diagonSet.has('foo')).toEqual(false);
        });

        describe('mixing proxies and originals as values', () => {
            it('marks original as value previously stored when initialized with original.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(value);

                const diagonSet = new DiagonSet<typeof value>(target);
                diagonSet.delete(valueProxy);

                expect(diagonSet.has(value)).toEqual(false);
                expect(diagonSet.has(valueProxy)).toEqual(false);
                expect(diagonSet.size).toEqual(0);

                expect(diagonSet.currentPatch.get(value)).toEqual(true);
                expect(diagonSet.currentPatch.get(valueProxy)).toEqual(undefined);

                expect(target.has(value)).toEqual(false);
                expect(target.has(valueProxy)).toEqual(false);
            });

            it('marks proxy as value previously stored when initialized with proxy.', () => {
                const target = new Set<typeof value>();
                const value = { prop0: 'foo' };
                const valueProxy = createRecordingProxy(value);

                target.add(valueProxy);

                const diagonSet = new DiagonSet<typeof value>(target);
                diagonSet.delete(value);

                expect(diagonSet.has(value)).toEqual(false);
                expect(diagonSet.has(valueProxy)).toEqual(false);
                expect(diagonSet.size).toEqual(0);

                expect(diagonSet.currentPatch.get(value)).toEqual(undefined);
                expect(diagonSet.currentPatch.get(valueProxy)).toEqual(true);

                expect(target.has(value)).toEqual(false);
                expect(target.has(valueProxy)).toEqual(false);
            });
        });
    });

    describe(`[${ORIGINAL.description}]`, () => {
        it(`returns target.`, () => {
            const target = new Set<string>();

            const diagonSet = new DiagonSet<string>(target);
            expect(diagonSet[ORIGINAL]).toBe(target);
        });
    });

    describe('clear()', () => {
        it('records previous value when present.', () => {
            const target = new Set<string>();
            target.add('foo');
            target.add('bar');
            target.add('bob');

            const diagonSet = new DiagonSet<string>(target);

            diagonSet.clear();

            expect(diagonSet.currentPatch.get('foo')).toEqual(true);
            expect(diagonSet.currentPatch.get('bar')).toEqual(true);
            expect(diagonSet.currentPatch.get('bob')).toEqual(true);

            expect(diagonSet.has('foo')).toEqual(false);
            expect(diagonSet.has('bar')).toEqual(false);
            expect(diagonSet.has('bob')).toEqual(false);
        });
    });

    describe('foreach()', () => {
        it('returns proxies of values', () => {
            const target = new Set<Record<string, unknown>>();
            const valueObject0 = { prop0: 'foo' };
            const valueObject1 = { prop0: 'bar' };

            const diagonSet = new DiagonSet<Record<string, unknown>>(target);
            diagonSet.add(valueObject0);
            diagonSet.add(valueObject1);

            let iterationCount = 0;
            diagonSet.forEach((value, key) => {
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
            const diagonSet = new DiagonSet(target);

            expect(diagonSet.has(entries[0])).toEqual(true);
            expect(diagonSet.has(entry0Proxy)).toEqual(true);
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
                const diagonSet = new DiagonSet(target);

                let i = 0;
                for (const value of diagonSet.values()) {
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
                const diagonMap = new DiagonSet(target);

                let i = 0;
                for (const [value0, value1] of diagonMap.entries()) {
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
            clearModified();
        });

        it('returns map of differences and clears diagon map', () => {
            const target = new Set<string>();

            const diagonSet = new DiagonSet<string>(target);
            diagonSet.add('fooo');

            expect(diagonSet.currentPatch.size).toEqual(1);

            const previous = diagonSet.commitPatch();

            expect(patchToSource.get(previous)).toBe(target);
            expect(diagonSet.size).toEqual(1);
            expect(diagonSet.currentPatch.size).toEqual(0);
        });

    });

    describe('as part of an object proxy', () => {
        beforeEach(() => {
            resetEnvironment();
        });

        afterEach(() => {
            clearModified();
        });

        it('proxies when child property', () => {
            const underlyingSet = new Set<string>();
            const state = { name: 'bob', setProp: underlyingSet };

            const history = [];
            history.push(recordPatches(state, state => state.setProp.add('fdfd')));
            expect(tryGetProxy(underlyingSet)).toBeDefined();

            let timeline = getObjectTimeline(history, underlyingSet);

            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));

            history.push(recordPatches(state, state => state.setProp.add('bob')));

            timeline = getObjectTimeline(history, underlyingSet);

            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));
            expect(timeline[1][1]).toEqual(new Map([['bob', false]]));
        });

        it('records history', () => {
            const state = new Set<string>();

            const history = [];
            history.push(recordPatches(state, state => state.add('fdfd')));

            let timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));

            history.push(recordPatches(state, state => state.add('bob')));

            timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['fdfd', false]]));
            expect(timeline[1][1]).toEqual(new Map([['bob', false]]));

            history.push(recordPatches(state, state => state.delete('fdfd')));

            timeline = getObjectTimeline(history, state);
            expect(timeline[2][1]).toEqual(new Map([['fdfd', true]]));
        });
    });
});