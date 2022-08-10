
import { DimmerMap } from './dimmerMap';
import { clearContext, createRecordingProxy, asOriginal, isProxy, recordPatches, resetEnvironment, patchToTarget } from './dimmer';
import { NO_ENTRY, ORIGINAL, PROXY } from './types';
import { getObjectTimeline } from './history';

describe('DimmerMap', () => {

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
        const dimmerMap = new DimmerMap<number, string>(new Map());
        expect(dimmerMap).toBeDefined();
        expect(dimmerMap).toBeInstanceOf(Map);
    });

    describe('get()', () => {
        describe('mixed use of object-typed keys', () => {
            it('retrieves value when initialized with original as key and then fetched with proxy.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(key, 1231);

                const dimmerMap = new DimmerMap<typeof key, number>(target);
                expect(dimmerMap.get(keyProxy)).toEqual(1231);
                expect(dimmerMap.size).toEqual(1);

                expect(Map.prototype.get.call(dimmerMap, key)).toEqual(undefined);
            });

            it('retrieves value when initialized with proxy as key and then fetched with original.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(keyProxy, 1231);

                const dimmerMap = new DimmerMap<typeof key, number>(target);
                expect(dimmerMap.get(key)).toEqual(1231);
                expect(dimmerMap.size).toEqual(1);

                expect(Map.prototype.get.call(dimmerMap, key)).toEqual(undefined);
            });
        });
    });

    describe('set()', () => {
        it(`records ${NO_ENTRY.description} for newly added entries.`, () => {
            const target = new Map();

            const dimmerMap = new DimmerMap<string, number>(target);
            dimmerMap.set('foo', 1000);

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toEqual(NO_ENTRY);
            expect(dimmerMap.get('foo')).toEqual(1000);
        });

        it('records previous value for newly added entries.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const dimmerMap = new DimmerMap<string, number>(target);
            expect(dimmerMap.size).toEqual(1);

            dimmerMap.set('foo', 42);

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toEqual(1231);
            expect(dimmerMap.get('foo')).toEqual(42);
        });

        it('records initial value when setting property multiple times.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const dimmerMap = new DimmerMap<string, number>(target);

            dimmerMap.set('foo', 42);
            dimmerMap.set('foo', 88);

            expect(dimmerMap.size).toEqual(1);

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toEqual(1231);
            expect(dimmerMap.get('foo')).toEqual(88);
        });
    });

    describe('delete()', () => {
        it(`records nothing if did not previously have value.`, () => {
            const target = new Map();

            const dimmerMap = new DimmerMap<string, number>(target);
            dimmerMap.delete('foo');

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toBeUndefined();
            expect(dimmerMap.get('foo')).toBeUndefined();
        });

        it('records previous value when present.', () => {
            const target = new Map();
            target.set('foo', 1231);
            const dimmerMap = new DimmerMap<string, number>(target);

            dimmerMap.delete('foo');

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toEqual(1231);
            expect(dimmerMap.get('foo')).toBeUndefined();
        });

        describe('mixed use of object-typed keys', () => {
            it('records previous value with proxy as key when proxy is current type of key.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(keyProxy, 1231);

                const dimmerMap = new DimmerMap<typeof key, number>(target);
                //dimmerMap.commitPatch();                

                dimmerMap.delete(key);

                expect(dimmerMap.has(key)).toEqual(false);
                expect(dimmerMap.size).toEqual(0);

                expect(Map.prototype.get.call(dimmerMap, keyProxy)).toEqual(1231);
                expect(Map.prototype.get.call(dimmerMap, key)).toBeUndefined();
            });

            it('records previous value with original as key when original is current type of key.', () => {
                const target = new Map();
                const key = { prop0: 'foo' };
                const keyProxy = createRecordingProxy(key);

                target.set(key, 1231);

                const dimmerMap = new DimmerMap<typeof key, number>(target);
                //dimmerMap.commitPatch();                

                dimmerMap.delete(keyProxy);

                expect(dimmerMap.has(key)).toEqual(false);
                expect(dimmerMap.size).toEqual(0);

                expect(Map.prototype.get.call(dimmerMap, keyProxy)).toBeUndefined();
                expect(Map.prototype.get.call(dimmerMap, key)).toEqual(1231);
            });
        });
    });

    describe(`[${ORIGINAL.description}]`, () => {
        it(`returns target.`, () => {
            const target = new Map();

            const dimmerMap = new DimmerMap<string, number>(target);
            expect(dimmerMap[ORIGINAL]).toBe(target);
        });
    });

    describe(`[${PROXY.description}]`, () => {
        it(`returns dimmer map for both target and dimmer map target.`, () => {
            const target = new Map();

            const dimmerMap = new DimmerMap<string, number>(target);
            expect((target as any)[PROXY]).toBe(dimmerMap);
            expect(dimmerMap[PROXY]).toBe(dimmerMap);
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

            const dimmerMap = new DimmerMap<string, number>(target);

            dimmerMap.clear();

            expect(Map.prototype.get.call(dimmerMap, 'foo')).toEqual(1231);
            expect(Map.prototype.get.call(dimmerMap, 'bar')).toEqual(848);
            expect(Map.prototype.get.call(dimmerMap, 'bob')).toEqual(7777);

            expect(dimmerMap.get('foo')).toBeUndefined();
            expect(dimmerMap.get('bar')).toBeUndefined();
            expect(dimmerMap.get('bob')).toBeUndefined();
        });
    });

    describe('foreach()', () => {
        it('returns proxies of values', () => {
            const target = new Map<string, Record<string, unknown>>();
            const valueObject0 = { prop0: 'foo' };
            const valueObject1 = { prop0: 'bar' };

            const dimmerMap = new DimmerMap<string, Record<string, unknown>>(target);
            dimmerMap.set('obj0', valueObject0);
            dimmerMap.set('obj1', valueObject1);

            let iterationCount = 0;
            dimmerMap.forEach((value, key) => {
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
            const dimmerMap = new DimmerMap(target);

            const value0Proxy = dimmerMap.get(entries[0][0])!;
            expect(isProxy(value0Proxy)).toEqual(true);

            const key0Proxy = createRecordingProxy(entries[0][0]);
            expect(isProxy(key0Proxy)).toEqual(true);
            expect(dimmerMap.get(key0Proxy)).toBe(value0Proxy);
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
                const dimmerMap = new DimmerMap(target);

                let i = 0;
                for (const key of dimmerMap.keys()) {
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
                const dimmerMap = new DimmerMap(target);

                let i = 0;
                for (const value of dimmerMap.values()) {
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
                const dimmerMap = new DimmerMap(target);

                let i = 0;
                for (const [key, value] of dimmerMap.entries()) {
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

        it('returns map of differences and clears dimmer map', () => {
            const target = new Map<string, number>();

            const dimmerMap = new DimmerMap<string, number>(target);
            dimmerMap.set('fooo', 2234);

            expect(Reflect.get(Map.prototype, 'size', dimmerMap)).toEqual(1);

            const previous = dimmerMap.commitPatch();

            expect(patchToTarget.get(previous)).toBe(target);
            expect(dimmerMap.size).toEqual(1);
            expect(Reflect.get(Map.prototype, 'size', dimmerMap)).toEqual(0);
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