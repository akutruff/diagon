import { createRecordingProxy, resetEnvironment } from './dimmer';
import { all, elements } from './pathRecorder';
import { createChangeRecorderFactory, createDeltaTracker, DeltaTracker, MutatorChangeRecorderFactory, recordAndPublishMutations, subscribe, subscribeDeep, subscribeRecursive } from './subscriptions';

describe('subscriptions', () => {
    let deltaTracker: DeltaTracker;
    let createMutator: MutatorChangeRecorderFactory;

    beforeEach(() => {
        resetEnvironment();
        deltaTracker = createDeltaTracker();
        createMutator = createChangeRecorderFactory(deltaTracker, recordAndPublishMutations);
    });

    function createIncrementerState() {
        const state = {
            count: 0,
        };

        createRecordingProxy(state);
        return state;
    }

    type IncrementerState = ReturnType<typeof createIncrementerState>;

    it('updates when single property changes', async () => {
        const state = createIncrementerState();

        const increment = createMutator((state: IncrementerState, value: number) => state.count += value);

        const callback = jest.fn(() => { });

        subscribe(deltaTracker, state, state => state.count, callback);
        expect(callback).not.toHaveBeenCalled();

        increment(state, 1);
        expect(callback).toBeCalledTimes(1);
        expect(state.count).toEqual(1);

        increment(state, 1);
        expect(callback).toBeCalledTimes(2);
        expect(state.count).toEqual(2);
    });

    type Person = { name: string, age?: number };
    function createPersonState() {
        const state = {
            bob: { name: 'Bob', age: 41 } as Person
        };

        createRecordingProxy(state);
        return state;
    }

    type PersonState = ReturnType<typeof createPersonState>;

    it('supports deep properties hierarchies', async () => {
        const state = createPersonState();

        const changePerson = createMutator((state: PersonState, value: string) => state.bob = { name: value });

        const callback = jest.fn(() => { });

        subscribe(deltaTracker, state, state => state.bob, callback);
        expect(callback).not.toHaveBeenCalled();

        changePerson(state, 'Robert');
        expect(callback).toBeCalledTimes(1);
        expect(state.bob.name).toEqual('Robert');

        changePerson(state, 'Walter');
        expect(callback).toBeCalledTimes(2);
        expect(state.bob.name).toEqual('Walter');
    });

    it('ignores unsubscribed properties', async () => {
        const state = createPersonState();

        const changeAge = createMutator((state: PersonState, value: number) => {
            state.bob.age = value;
        });

        const callback = jest.fn(() => { });

        subscribe(deltaTracker, state, state => state.bob.name, callback);
        expect(callback).not.toHaveBeenCalled();

        changeAge(state, 42);
        expect(callback).not.toHaveBeenCalled();
        expect(state.bob.age).toEqual(42);
    });

    it('reacts to any property change', async () => {
        const state = createPersonState();

        const changePerson = createMutator((state: PersonState, value: string) => state.bob = { name: value });

        const callback = jest.fn(() => { });

        subscribe(deltaTracker, state, state => all(state), callback);
        expect(callback).not.toHaveBeenCalled();

        changePerson(state, 'Robert');
        expect(callback).toBeCalledTimes(1);
        expect(state.bob.name).toEqual('Robert');

        changePerson(state, 'Walter');
        expect(callback).toBeCalledTimes(2);
        expect(state.bob.name).toEqual('Walter');
    });

    it('reacts to any property change when property added', async () => {
        const targetState = {
            bob: { name: 'Bob' } as Person
        };

        const state = createRecordingProxy(targetState);

        const changePerson = createMutator((state: PersonState, value: number) => state.bob.age = value);

        const callback = jest.fn(() => { });

        subscribe(deltaTracker, state, state => all(state.bob), callback);
        expect(callback).not.toHaveBeenCalled();

        changePerson(state, 113);
        expect(callback).toBeCalledTimes(1);
        expect(state.bob.age).toEqual(113);

        changePerson(state, 24);
        expect(callback).toBeCalledTimes(2);
        expect(state.bob.age).toEqual(24);

        changePerson(state, 24);
        expect(callback).toBeCalledTimes(2);
        expect(state.bob.age).toEqual(24);
    });


    function createPeopleState() {
        const state = {
            people: [{ name: 'Bob' }, { name: 'Sally' }] as Person[],
        };

        createRecordingProxy(state);
        return state;
    }
    type PeopleState = ReturnType<typeof createPeopleState>;

    describe('Arrays', () => {
        it('subscribes to individual element changes', async () => {
            const state = createPeopleState();

            const changeName = createMutator((state: PeopleState, index: number, value: string) => state.people[index].name = value);
            const changePerson = createMutator((state: PeopleState, index: number, value: string) => state.people[index] = { name: value });

            const callback = jest.fn(() => { });

            subscribe(deltaTracker, state, state => state.people[0].name, callback);
            expect(callback).not.toHaveBeenCalled();

            changeName(state, 0, 'Robert');
            expect(callback).toBeCalledTimes(1);
            expect(state.people[0].name).toEqual('Robert');

            changePerson(state, 0, 'Walter');
            expect(callback).toBeCalledTimes(2);
            expect(state.people[0].name).toEqual('Walter');
        });

        it('ignores changes to unsubscribed elements', async () => {
            const state = createPeopleState();

            const changeName = createMutator((state: PeopleState, index: number, value: string) => state.people[index].name = value);
            const changePerson = createMutator((state: PeopleState, index: number, value: string) => state.people[index] = { name: value });

            const callback = jest.fn(() => { });

            subscribe(deltaTracker, state, state => state.people[0].name, callback);
            expect(callback).not.toHaveBeenCalled();

            changeName(state, 1, 'Jessica');
            expect(callback).not.toHaveBeenCalled();
            expect(state.people[1].name).toEqual('Jessica');

            changePerson(state, 1, 'Joan');
            expect(callback).not.toHaveBeenCalled();
            expect(state.people[1].name).toEqual('Joan');
        });

        it('reacts to any change shallow to items in collection when subscribed to Sybmol.Iterator', async () => {
            const state = createPeopleState();

            const changeName = createMutator((state: PeopleState, index: number, value: string) => state.people[index].name = value);
            const changePerson = createMutator((state: PeopleState, index: number, value: string) => state.people[index] = { name: value });

            const callback = jest.fn(() => { });

            subscribe(deltaTracker, state, state => state.people[Symbol.iterator], callback);
            expect(callback).not.toHaveBeenCalled();

            changeName(state, 1, 'Jessica');
            expect(callback).not.toHaveBeenCalled();
            expect(state.people[1].name).toEqual('Jessica');

            changePerson(state, 1, 'Joan');
            expect(callback).toBeCalledTimes(1);
            expect(callback.mock.calls.length).toEqual(1);
            expect(state.people[1].name).toEqual('Joan');
        });
    });

    describe('Map<>', () => {
        it.todo('works with maps');
    });

    describe('Set<>', () => {
        it.todo('works with sets');
    });

    function createGridState(): Grid {
        return {
            grid: [
                [{ name: 'p00' }, { name: 'p01' }],
                [{ name: 'p10' }, { name: 'p11' }],
            ],
        };
    }

    interface Grid {
        grid: Person[][];
    }
    describe('subscribeRecursive', () => {
        it.todo('reacts to row additions');
        //TODO:
        // subscribeRecursive(deltaTracker,
        //     state,
        //     state => elements(state.grid),
        //     (grid, subber) =>
        //         grid.map(row => subber(
        //             row,
        //             row => elements(row),
        //             row => row.map(element => subber(
        //                 element,
        //                 element => element.name))
        //         )),
        //     callback);
    });
    describe('subscribeDeep', () => {
        it('reacts to row additions', () => {
            const state = createGridState();

            const callback = jest.fn(() => { });

            const subscribeToRows = jest.fn((tracker: DeltaTracker, grid: Person[][], callback: () => void) =>
                grid.map(row => subscribe(tracker, row, row => elements(row), callback))
            );

            const addRow = createMutator((state: Grid, value: Person[]) => state.grid.push(value));

            subscribeDeep(deltaTracker, state, state => elements(state.grid), subscribeToRows, callback);
            expect(subscribeToRows).toHaveBeenCalledTimes(1);

            expect(callback).not.toHaveBeenCalled();

            addRow(state, [{ name: 'p20' }, { name: 'p21' }]);

            subscribeRecursive(deltaTracker,
                state,
                state => elements(state.grid),
                (grid, subber) =>
                    grid.map(row => subber(
                        row,
                        row => elements(row),
                        row => row.map(element => subber(
                            element,
                            element => element.name))
                    )),
                callback);


            expect(callback).toHaveBeenCalledTimes(1);
            expect(subscribeToRows).toHaveBeenCalledTimes(2);
        });

        it('reacts to additions in children without resubscribing', () => {
            const state = createGridState();

            const callback = jest.fn(() => { });

            const subscribeToRows = jest.fn(function (tracker: DeltaTracker, grid: Person[][], parentCallback: () => void): Array<() => void> {
                return grid.map(row => subscribe(tracker, row, row => elements(row), parentCallback));
            });

            const addElementToRow = createMutator((state: Person[], value: Person) => state.push(value));

            subscribeDeep(deltaTracker, state, state => elements(state.grid), subscribeToRows, callback);
            expect(subscribeToRows).toHaveBeenCalledTimes(1);
            expect(callback).not.toHaveBeenCalled();

            addElementToRow(state.grid[0], { name: 'p03' });
            expect(callback).toHaveBeenCalledTimes(1);
            expect(subscribeToRows).toHaveBeenCalledTimes(1);
        });

        it('unsubscribes from everything when top level unsubscribing function is called', () => {
            const state = createGridState();

            const callback = jest.fn(() => { });

            const unsubscribeCallbacks: Array<() => void> = [];

            const subscribeToRows = jest.fn(function (tracker: DeltaTracker, grid: Person[][], parentCallback: () => void): Array<() => void> {
                const newRowSubs = grid.map(row => {
                    const unsubFromRow = jest.fn(subscribe(tracker, row, row => elements(row), parentCallback));
                    unsubscribeCallbacks.push(unsubFromRow);
                    return unsubFromRow;
                });

                return newRowSubs;
            });

            const addRow = createMutator((state: Grid, value: Person[]) => state.grid.push(value));
            const addElementToRow = createMutator((state: Person[], value: Person) => state.push(value));

            const unsubscribe = subscribeDeep(deltaTracker, state, state => elements(state.grid), subscribeToRows, callback);
            expect(subscribeToRows).toHaveBeenCalledTimes(1);
            expect(unsubscribeCallbacks.length).toEqual(2);

            expect(callback).toHaveBeenCalledTimes(0);
            for (const unsub of unsubscribeCallbacks) {
                expect(unsub).not.toHaveBeenCalled();
            }

            expect(callback).not.toHaveBeenCalled();

            unsubscribe();

            for (const unsub of unsubscribeCallbacks) {
                expect(unsub).toHaveBeenCalledTimes(1);
            }

            addElementToRow(state.grid[0], { name: 'p03' });
            addRow(state, [{ name: 'p20' }]);

            for (const unsub of unsubscribeCallbacks) {
                expect(unsub).toHaveBeenCalledTimes(1);
            }

            expect(subscribeToRows).toHaveBeenCalledTimes(1);
            expect(callback).not.toHaveBeenCalled();
        });

        it('unsubscribes from children only when parent property changes', () => {
            const state = createGridState();

            const callback = jest.fn(() => { });

            let lastElementSubscriptions: Array<() => void> = [];
            const subscribeToRows = jest.fn(function (tracker: DeltaTracker, grid: Person[][], parentCallback: () => void): Array<() => void> {
                lastElementSubscriptions = [];

                const newRowSubs = grid.map(row => {
                    const unsubFromRow = jest.fn(subscribe(tracker, row, row => elements(row), parentCallback));
                    lastElementSubscriptions.push(unsubFromRow);
                    return unsubFromRow;
                });

                return newRowSubs;
            });

            const addRow = createMutator((state: Grid, value: Person[]) => state.grid.push(value));

            const topLevelSubscription = jest.fn(subscribeDeep(deltaTracker, state, state => elements(state.grid), subscribeToRows, callback));

            const initialSubscriptions = lastElementSubscriptions;

            expect(initialSubscriptions.length).toEqual(2);

            for (const unsub of initialSubscriptions) {
                expect(unsub).not.toHaveBeenCalled();
            }

            addRow(state, [{ name: 'p20' }]);

            expect(callback).toHaveBeenCalledTimes(1);

            for (const unsub of initialSubscriptions) {
                expect(unsub).toHaveBeenCalledTimes(1);
            }

            const secondElementSubscriptions = lastElementSubscriptions;
            expect(secondElementSubscriptions.length).toEqual(3);
            expect(secondElementSubscriptions[0]).not.toEqual(initialSubscriptions[0]);

            addRow(state, [{ name: 'p30' }]);
            expect(callback).toHaveBeenCalledTimes(2);

            for (const unsub of initialSubscriptions) {
                expect(unsub).toHaveBeenCalledTimes(1);
            }

            for (const unsub of secondElementSubscriptions) {
                expect(unsub).toHaveBeenCalledTimes(1);
            }

            expect(topLevelSubscription).not.toHaveBeenCalled();
        });
    });
});