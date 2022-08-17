
import { createRecordingProxy, asOriginal, isProxy, recordPatches, resetEnvironment, tryGetProxy, getCurrentPatch } from './diagon';
import { getObjectTimeline } from './history';

describe('DiagonArray', () => {
    beforeEach(() => {
        resetEnvironment();
    });

    describe('createArrayProxy()', () => {
        it('wraps in a proxy', () => {
            const target = ['a', 'b', 'c'];
            const proxy = createRecordingProxy(target);
            expect(proxy).not.toBe(target);
            expect(isProxy(proxy)).toBeTruthy();
            expect(tryGetProxy(target)).toBeTruthy();
        });
    });

    it('gets primitive types transparently', () => {
        const target = ['a', 'b', 'c'];
        const proxy = createRecordingProxy(target);
        expect(proxy[0]).toEqual('a');
        expect(proxy[2]).toEqual('c');
    });

    it('sets primitive types transparently', () => {
        const target = ['a', 'b', 'c'];
        const proxy = createRecordingProxy(target);
        proxy[1] = 'q';
        expect(proxy[1]).toEqual('q');
    });

    it('updates length property when adding a value', () => {
        const target = [{ prop0: 'a' }, { prop0: 'b' }];

        const proxy = createRecordingProxy(target);
        const newValue = { prop0: 'q' };
        proxy.push(newValue);
        expect(asOriginal(proxy[2])).toBe(newValue);

        expect(proxy).toHaveLength(3);
    });

    it('creates proxies when getting objects', () => {
        const target = [{ prop0: 'a' }, { prop0: 'b' }];
        const copyOfOriginal = [...target];

        const proxy = createRecordingProxy(target);
        proxy[1] = { prop0: 'q' };
        expect(proxy[1]).toMatchObject({ prop0: 'q' });
        expect(isProxy(proxy[1])).toBeTruthy();


        expect(getCurrentPatch(target)![1]).toMatchObject({ prop0: 'b' });
        expect(getCurrentPatch(target)![1]).toBe(copyOfOriginal[1]);
    });

    describe('splice()', () => {
        it('acts just like normal array splicing', () => {
            const target = [{ prop0: 'a' }, { prop0: 'b' }];
            const copyOfOriginal = [...target];

            const proxy = createRecordingProxy(target);

            const sliced = proxy.slice(1);
            expect(sliced[0]).toEqual(copyOfOriginal[1]);
            expect(isProxy(sliced[0])).toBeTruthy();

        });
    });

    describe('pop()', () => {
        it('records history', () => {
            const target = [{ prop0: 'a' }, { prop0: 'b' }];

            const proxy = createRecordingProxy(target);
            const poppedValue = proxy.pop();
            expect(isProxy(poppedValue)).toBeTruthy();
            expect(getCurrentPatch(target)).toMatchObject([{ prop0: 'a' }, { prop0: 'b' }]);
        });
    });

    it('records patches when set length to zero', () => {
        const state = [{ prop0: 'a' }, { prop0: 'b' }];

        const history = [];
        history.push(recordPatches(state, (state: any[]) => state.length = 0));

        const timeline = getObjectTimeline(history, state);
        const previous0 = timeline[0][1];

        expect(previous0).toEqual([{ prop0: 'a' }, { prop0: 'b' }]);
        expect(getCurrentPatch(state)).toBeUndefined();
    });

    describe('commitChanges()', () => {
        it('returns original contents and sets [PREVIOUS] property to undefined', () => {
            const state = [{ prop0: 'a' }, { prop0: 'b' }];

            const history = [];
            history.push(recordPatches(state, (state) => state.push({ prop0: 'q' })));
            history.push(recordPatches(state, (state) => state[2] = { prop0: 'r' }));

            const timeline = getObjectTimeline(history, state);
            const previous0 = timeline[0][1];

            expect(previous0).toEqual([{ prop0: 'a' }, { prop0: 'b' }]);
            expect(getCurrentPatch(state)).toBeUndefined();

            const previous1 = timeline[1][1];
            expect(previous1).toEqual([{ prop0: 'a' }, { prop0: 'b' }, { prop0: 'q' }]);
            expect(getCurrentPatch(state)).toBeUndefined();
        });
    });
});