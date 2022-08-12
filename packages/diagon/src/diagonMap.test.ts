
import { DiagonMap } from './diagonMap';
import { clearContext, createRecordingProxy, asOriginal, isProxy, recordPatches, resetEnvironment, patchToTarget } from './diagon';
import { NO_ENTRY, ORIGINAL, PROXY } from './types';
import { getObjectTimeline } from './history';

describe('DiagonMap', () => {

    type Node = { prop0: string };

    function createTestEntries() {
        const entries: [Node, Node][] = [
            [{ prop0: 'key0' }, { prop0: 'value0' }],
            [{ prop0: 'key1' }, { prop0: 'value1' }],
        ];
        return entries;
    }

    beforeEach(() => {
        resetEnvironment();
    });

    it('can be constructed', () => {
        const diagonMap = new DiagonMap<number, string>(new Map());
        expect(diagonMap).toBeDefined();
        expect(diagonMap).toBeInstanceOf(Map);
    });

    describe('get()', () => {
        describe('mixed use of object-typed keys', () => {
            it('retrieves value when initialized with original as key and then fetched with proxy.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(key, 1231);

                const diagonMap = new DiagonMap<typeof key, number>(target);
                expect(diagonMap.get(keyProxy)).toEqual(1231);
                expect(diagonMap.size).toEqual(1);

                expect(Map.prototype.get.call(diagonMap, key)).toEqual(undefined);
            });

            it('retrieves value when initialized with proxy as key and then fetched with original.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(keyProxy, 1231);

                const diagonMap = new DiagonMap<typeof key, number>(target);
                expect(diagonMap.get(key)).toEqual(1231);
                expect(diagonMap.size).toEqual(1);

                expect(Map.prototype.get.call(diagonMap, key)).toEqual(undefined);
            });
        });
    });

    describe('set()', () => {
        it(`records ${NO_ENTRY.description} for newly added entries.`, () => {
            const target = new Map();

            const diagonMap = new DiagonMap<string, number>(target);
            diagonMap.set('foo', 1000);

            expect(Map.prototype.get.call(diagonMap, 'foo')).toEqual(NO_ENTRY);
            expect(diagonMap.get('foo')).toEqual(1000);
        });

        it('records previous value for newly added entries.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const diagonMap = new DiagonMap<string, number>(target);
            expect(diagonMap.size).toEqual(1);

            diagonMap.set('foo', 42);

            expect(Map.prototype.get.call(diagonMap, 'foo')).toEqual(1231);
            expect(diagonMap.get('foo')).toEqual(42);
        });

        it('records initial value when setting property multiple times.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const diagonMap = new DiagonMap<string, number>(target);

            diagonMap.set('foo', 42);
            diagonMap.set('foo', 88);

            expect(diagonMap.size).toEqual(1);

            expect(Map.prototype.get.call(diagonMap, 'foo')).toEqual(1231);
            expect(diagonMap.get('foo')).toEqual(88);
        });
    });

    describe('delete()', () => {
        it(`records nothing if did not previously have value.`, () => {
            const target = new Map();

            const diagonMap = new DiagonMap<string, number>(target);
            diagonMap.delete('foo');

            expect(Map.prototype.get.call(diagonMap, 'foo')).toBeUndefined();
            expect(diagonMap.get('foo')).toBeUndefined();
        });

        it('records previous value when present.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const diagonMap = new DiagonMap<string, number>(target);

            diagonMap.delete('foo');

            expect(Map.prototype.get.call(diagonMap, 'foo')).toEqual(1231);
            expect(diagonMap.get('foo')).toBeUndefined();
        });

        describe('mixed use of object-typed keys', () => {
            it('records previous value with proxy as key when proxy is current type of key.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(keyProxy, 1231);

                const diagonMap = new DiagonMap<typeof key, number>(target);
                //diagonMap.commitPatch();                

                diagonMap.delete(key);

                expect(diagonMap.has(key)).toEqual(false);
                expect(diagonMap.size).toEqual(0);

                expect(Map.prototype.get.call(diagonMap, keyProxy)).toEqual(1231);
                expect(Map.prototype.get.call(diagonMap, key)).toBeUndefined();
            });

            it('records previous value with original as key when original is current type of key.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(key, 1231);

                const diagonMap = new DiagonMap<typeof key, number>(target);
                //diagonMap.commitPatch();                

                diagonMap.delete(keyProxy);

                expect(diagonMap.has(key)).toEqual(false);
                expect(diagonMap.size).toEqual(0);

                expect(Map.prototype.get.call(diagonMap, keyProxy)).toBeUndefined();
                expect(Map.prototype.get.call(diagonMap, key)).toEqual(1231);
            });
        });
    });

    describe(`[${ORIGINAL.description}]`, () => {
        it(`returns target.`, () => {
            const target = new Map();

            const diagonMap = new DiagonMap<string, number>(target);
            expect(diagonMap[ORIGINAL]).toBe(target);
        });
    });

    describe(`[${PROXY.description}]`, () => {
        it(`returns diagon map for both target and diagon map target.`, () => {
            const target = new Map();

            const diagonMap = new DiagonMap<string, number>(target);
            expect((target as any)[PROXY]).toBe(diagonMap);
            expect(diagonMap[PROXY]).toBe(diagonMap);
        });
        it('is typeof object', () => {
            expect(typeof null).toEqual('object');
        });
    });

    describe('clear()', () => {
        it('records previous value when present.', () => {
            const target = new Map<string, number>();
            target.set('foo', 1231);
            target.set('bar', 848);
            target.set('bob', 7777);

            const diagonMap = new DiagonMap<string, number>(target);

            diagonMap.clear();

            expect(Map.prototype.get.call(diagonMap, 'foo')).toEqual(1231);
            expect(Map.prototype.get.call(diagonMap, 'bar')).toEqual(848);
            expect(Map.prototype.get.call(diagonMap, 'bob')).toEqual(7777);

            expect(diagonMap.get('foo')).toBeUndefined();
            expect(diagonMap.get('bar')).toBeUndefined();
            expect(diagonMap.get('bob')).toBeUndefined();
        });
    });

    describe('foreach()', () => {
        it('returns proxies of values', () => {
            const target = new Map<string, Record<string, unknown>>();
            const valueObject0 = { prop0: 'foo' };
            const valueObject1 = { prop0: 'bar' };

            const diagonMap = new DiagonMap<string, Record<string, unknown>>(target);
            diagonMap.set('obj0', valueObject0);
            diagonMap.set('obj1', valueObject1);

            let iterationCount = 0;
            diagonMap.forEach((value, key) => {
                iterationCount++;

                expect(isProxy(value)).toBeTruthy();

                switch (key) {
                    case 'obj0':
                        // eslint-disable-next-line jest/no-conditional-expect
                        expect(asOriginal(value)).toBe(valueObject0);
                        break;
                    case 'obj1':
                        // eslint-disable-next-line jest/no-conditional-expect
                        expect(asOriginal(value)).toBe(valueObject1);
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

            const target = new Map(entries);
            const diagonMap = new DiagonMap(target);

            const value0Proxy = diagonMap.get(entries[0][0])!;
            expect(isProxy(value0Proxy)).toEqual(true);

            const key0Proxy = createRecordingProxy(entries[0][0]);
            expect(isProxy(key0Proxy)).toEqual(true);
            expect(diagonMap.get(key0Proxy)).toBe(value0Proxy);
        });
    });

    describe('iteration', () => {
        beforeEach(() => {
            resetEnvironment();
        });

        describe('keys()', () => {
            it('returns proxiedKeys', () => {
                const entries = createTestEntries();

                const target = new Map(entries);
                const diagonMap = new DiagonMap(target);

                let i = 0;
                for (const key of diagonMap.keys()) {
                    expect(isProxy(key)).toEqual(true);
                    expect(asOriginal(key)).toBe(entries[i][0]);
                    i++;
                }
                expect(i).toEqual(2);
            });
        });

        describe('values()', () => {
            it('returns proxiedKeys', () => {
                const entries = createTestEntries();

                const target = new Map(entries);
                const diagonMap = new DiagonMap(target);

                let i = 0;
                for (const value of diagonMap.values()) {
                    expect(isProxy(value)).toEqual(true);
                    expect(asOriginal(value)).toBe(entries[i][1]);
                    i++;
                }
                expect(i).toEqual(2);
            });
        });

        describe('entries()', () => {
            it('returns proxiedKeys', () => {
                const entries = createTestEntries();

                const target = new Map(entries);
                const diagonMap = new DiagonMap(target);

                let i = 0;
                for (const [key, value] of diagonMap.entries()) {
                    expect(isProxy(key)).toEqual(true);
                    expect(asOriginal(key)).toBe(entries[i][0]);

                    expect(isProxy(value)).toEqual(true);
                    expect(asOriginal(value)).toBe(entries[i][1]);
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

        it('returns map of differences and clears diagon map', () => {
            const target = new Map<string, number>();

            const diagonMap = new DiagonMap<string, number>(target);
            diagonMap.set('fooo', 2234);

            expect(Reflect.get(Map.prototype, 'size', diagonMap)).toEqual(1);

            const previous = diagonMap.commitPatch();

            expect(patchToTarget.get(previous)).toBe(target);
            expect(diagonMap.size).toEqual(1);
            expect(Reflect.get(Map.prototype, 'size', diagonMap)).toEqual(0);
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
            const underlyingMap = new Map<string, number>();
            const state = { name: 'bob', mapProp: underlyingMap };
            type State = typeof state;

            const history = [];
            history.push(recordPatches((state: State) => state.mapProp.set('fdfd', 100), state));
            expect((underlyingMap as any)[PROXY]).toBeDefined();

            let timeline = getObjectTimeline(history, underlyingMap);

            expect(timeline[0][1]).toEqual(new Map([['fdfd', NO_ENTRY]]));

            history.push(recordPatches((state: State) => state.mapProp.set('fdfd', 311), state));

            timeline = getObjectTimeline(history, underlyingMap);
            expect(timeline[0][1]).toEqual(new Map([['fdfd', NO_ENTRY]]));
            expect(timeline[1][1]).toEqual(new Map([['fdfd', 100]]));
        });

        it('records history', () => {
            const state = new Map<string, number>();
            type State = typeof state;

            const history = [];
            history.push(recordPatches((state: State) => state.set('bob', 100), state));

            let timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['bob', NO_ENTRY]]));

            history.push(recordPatches((state: State) => state.set('bob', 100), state));

            timeline = getObjectTimeline(history, state);
            expect(timeline[0][1]).toEqual(new Map([['bob', NO_ENTRY]]));
            expect(timeline[1][1]).toEqual(new Map([['bob', 100]]));
        });
    });
});