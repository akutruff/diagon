/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Benchmark from 'benchmark';

import { createRecordingProxy, resetEnvironment } from '../dimmer';
import { suiteOptions } from './benchmarkOptions';
import { createChangeRecorderFactory, createDeltaTracker, recordAndPublishMutations, subscribe } from '../subscriptions';

const caseOptions: Benchmark.Options = {
    // minTime: -Infinity,
    // maxTime: -Infinity,
    // initCount: 1,
    // minSamples: 3,
};

function createStateWithCount() {
    return {
        count: 0,
    };
}

interface Address {
    streetName: string;
}

interface Person {
    name: string,
    bestFriend: Person | undefined,
    relations: Person[],
    address: Address,
}

function createPerson(name: string, bestFriend: Person | undefined, address: Address, relations: Person[]) {
    return { name, bestFriend, address, relations };
}

const dimmerCountSubscriber = (state: StateWithCount) => state.count;
const emptyCallback = () => { };

type StateWithCount = ReturnType<typeof createStateWithCount>;
{
    resetEnvironment();
    const deltaTracker = createDeltaTracker();

    const state = createStateWithCount();
    const proxy = createRecordingProxy(state);

    const personState = createDeepPeopleGraph();
    const personStateProxy = createRecordingProxy(state);

    const deltaTrackerForDeepSubscribe = createDeltaTracker();

    const suite = new Benchmark.Suite('Subscribe', { ...suiteOptions, ...{} });
    suite
        .add('Dimmer', function () {
            subscribe(deltaTracker, state, dimmerCountSubscriber, () => { });
        }, caseOptions)
        .add('Deep subscribe', function () {
            subscribe(deltaTrackerForDeepSubscribe, personState, state => state.bestFriend!.bestFriend!.bestFriend!.bestFriend!.name, () => { });
        }, caseOptions)
        .run();
}

{
    resetEnvironment();
    const deltaTracker = createDeltaTracker();
    const createMutator = createChangeRecorderFactory(deltaTracker, recordAndPublishMutations);
    const increment = createMutator((state: StateWithCount, value: number) => {
        state.count += value;
    });

    const state = createStateWithCount();
    const proxy = createRecordingProxy(state);

    subscribe(deltaTracker, state, dimmerCountSubscriber, () => { });

    const suite = new Benchmark.Suite('Trigger', { ...suiteOptions, ...{} });
    suite
        .add('Dimmer', function () {
            increment(state, 1);
        }, caseOptions)
        .run();

}

{
    const state = createDeepPeopleGraph();

    resetEnvironment();
    const deltaTracker = createDeltaTracker();
    const createMutator = createChangeRecorderFactory(deltaTracker, recordAndPublishMutations);
    const changeName = createMutator((state: Person, value: string) => {
        state.name = value;
    });

    const stateProxy = createRecordingProxy(state);

    subscribe(deltaTracker, state, state => state.name, () => { });
    subscribe(deltaTracker, state, state => state.bestFriend!.bestFriend!.bestFriend!.bestFriend!.name, () => { });
    const deepPerson = stateProxy.bestFriend!.bestFriend!.bestFriend!.bestFriend!;

    const suite = new Benchmark.Suite('Complicated state trigger', { ...suiteOptions, ...{} });
    suite
        .add('TopLevel property change', function () {
            changeName(state, 'changed');
        }, caseOptions)
        .add('Deep property change', function () {
            changeName(deepPerson, 'changed');
        }, caseOptions)
        .add('Deep property change with full accessor', function () {
            changeName(stateProxy.bestFriend!.bestFriend!.bestFriend!.bestFriend!, 'changed');
        }, caseOptions)
        .run();

}

function createDeepPeopleGraph() {
    const state = createPerson('bob', undefined, { streetName: '80 Main St' }, []);

    const peopleDepth = 5;
    const relationCount = 3;
    let currentPerson = state;
    for (let i = 0; i < peopleDepth; i++) {
        const newPerson = createPerson(`person${i}`, undefined, { streetName: `${i} Willow St` }, []);
        currentPerson.bestFriend = newPerson;

        for (let j = 0; j < relationCount; j++) {
            currentPerson.relations.push(createPerson(`relatedPerson${i}_${j}`, undefined, { streetName: `${i * peopleDepth + j} Elm St` }, []));
        }

        currentPerson = newPerson;
    }
    return state;
}
