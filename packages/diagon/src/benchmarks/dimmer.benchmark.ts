/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
import Benchmark from 'benchmark';
import { createDraft, setUseProxies, produce, setAutoFreeze, enableMapSet } from 'immer';
import { createRecordingProxy, makePatchRecorder } from '../diagon';
import _ from 'lodash';
import { suiteOptions } from './benchmarkOptions';

setUseProxies(true);
setAutoFreeze(false);
enableMapSet();

const caseOptions: Benchmark.Options = {
    // minTime: -Infinity,
    // maxTime: -Infinity,
    // initCount: 1,
    // minSamples: 3,
};

function createTestMap() {
    return new Map([
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
        [5, 0],
        [6, 0],
    ]);
}

type TargetMap = ReturnType<typeof createTestMap>;

const nativeMapReducer = (state: TargetMap, key: number, value: number) => { state.set(key, state.get(key)! + value); };
const immerMapReducer = produce((state: TargetMap, key: number, value: number) => { state.set(key, state.get(key)! + value); });
const diagonMapReducer = makePatchRecorder((state: TargetMap, key: number, value: number) => { state.set(key, state.get(key)! + value); });

const mapIterations = 100;

let suite = new Benchmark.Suite('Maps', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = createTestMap();
        for (let i = 0; i < mapIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                nativeMapReducer(state, j, i);
            }
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = createTestMap();
        for (let i = 0; i < mapIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                immerMapReducer(state, j, i);
            }
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = createTestMap();
        for (let i = 0; i < mapIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                diagonMapReducer(state, j, i);
            }
        }
    }, caseOptions)
    .run();



function createTestMapWithChildren() {
    return new Map([
        [0, { prop0: 0 }],
        [1, { prop0: 0 }],
        [2, { prop0: 0 }],
        [3, { prop0: 0 }],
        [4, { prop0: 0 }],
        [5, { prop0: 0 }],
        [6, { prop0: 0 }],
    ]);
}

type TargetMapWithChildren = ReturnType<typeof createTestMapWithChildren>;

const nativeMapWithChildren = (state: TargetMapWithChildren, key: number, value: number) => { const obj = state.get(key)!; obj.prop0 += value; state.set(key, obj); };
const immerMapWithChildren = produce((state: TargetMapWithChildren, key: number, value: number) => { const obj = state.get(key)!; obj.prop0 += value; state.set(key, obj); });
const diagonMapWithChildren = makePatchRecorder((state: TargetMapWithChildren, key: number, value: number) => { const obj = state.get(key)!; obj.prop0 += value; state.set(key, obj); });

const mapWithChildrenIterations = 100;

suite = new Benchmark.Suite('Maps with children', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = createTestMapWithChildren();
        for (let i = 0; i < mapWithChildrenIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                nativeMapWithChildren(state, j, i);
            }
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = createTestMapWithChildren();
        for (let i = 0; i < mapWithChildrenIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                immerMapWithChildren(state, j, i);
            }
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = createTestMapWithChildren();
        for (let i = 0; i < mapWithChildrenIterations; i++) {
            for (let j = 0; j < state.size; j++) {
                diagonMapWithChildren(state, j, i);
            }
        }
    }, caseOptions)
    .run();

function generateComplicatedGraph(numberOfProperties: number, maxDepth: number, depth = 0) {
    if (depth >= maxDepth) {
        throw new Error();//return undefined;
    }
    const result = {} as any;

    if (depth === maxDepth - 1) {
        for (let i = 0; i < numberOfProperties; i++) {
            result[`prop${i}`] = i;
        }
    } else {
        for (let i = 0; i < numberOfProperties; i++) {
            const propValue = generateComplicatedGraph(numberOfProperties, maxDepth, depth + 1);
            if (propValue) {
                result[`prop${i}`] = propValue;
            }
        }
    }

    return result;
}

function mutateComplicatedGraph(target: any, numberOfProperties: number, maxDepth: number, depth = 0) {
    if (depth >= maxDepth) {
        throw new Error();//return;
    }

    if (depth === maxDepth - 1) {
        for (let i = 0; i < numberOfProperties; i++) {
            target[`prop${i}`] += i;
        }
    } else {
        for (let i = 0; i < numberOfProperties; i++) {
            mutateComplicatedGraph(target[`prop${i}`], numberOfProperties, maxDepth, depth + 1);
        }
    }
}

function copyComplicatedGraph(target: any, numberOfProperties: number, maxDepth: number, depth = 0) {
    if (depth >= maxDepth) {
        throw new Error();//return undefined;
    }

    if (depth === maxDepth - 1) {
        const copy = { ...target };

        for (let i = 0; i < numberOfProperties; i++) {
            copy[`prop${i}`] += i;
        }
        return copy;
    } else {
        const copy = {} as any;
        for (let i = 0; i < numberOfProperties; i++) {
            const propertyValue = copyComplicatedGraph(target[`prop${i}`], numberOfProperties, maxDepth, depth + 1);
            if (propertyValue) {
                copy[`prop${i}`] = propertyValue;
            }
        }
        return copy;
    }
}

const numberOfProperties = 5;
const complicatedMaxDepth = 3;
const complicatedIterations = 100;

const nativeCopyGraphReducer = (state: any) => { copyComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); };
const immerCopyGraphReducer = produce((state: any) => { copyComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); });
const diagonCopyGraphReducer = makePatchRecorder((state: any) => { copyComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); });

suite = new Benchmark.Suite('Big Copies', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = nativeCopyGraphReducer(state);
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = immerCopyGraphReducer(state);
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = diagonCopyGraphReducer(state);
        }
    }, caseOptions)
    .run();

const nativeComplicatedGraphReducer = (state: any) => { mutateComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); };
const immerComplicatedGraphReducer = produce((state: any) => { mutateComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); });
const diagonComplicatedGraphReducer = makePatchRecorder((state: any) => { mutateComplicatedGraph(state, numberOfProperties, complicatedMaxDepth); });

suite = new Benchmark.Suite('Walk Complicated graph', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = nativeComplicatedGraphReducer(state);
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = immerComplicatedGraphReducer(state);
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = generateComplicatedGraph(numberOfProperties, complicatedMaxDepth);

        for (let i = 0; i < complicatedIterations; i++) {
            const produced = diagonComplicatedGraphReducer(state);
        }
    }, caseOptions)
    // .on('cycle', (event: any) => onCycle(suite, event))
    // .on('complete', () => onComplete(suite))
    .run();

function createSmallObjectGraph() {
    return {
        a: {
            aa: {
                aaa: {
                    aaaa: 'final'
                }
            }
        },
        b: {
            bb: {
                bbb: {
                    bbbb: 1000
                }
            }
        }
    };
}

type TargetObjectGraph = ReturnType<typeof createSmallObjectGraph>;

const nativeObjectGraphReducer = (state: TargetObjectGraph, aValue: string, bValue: number) => { state.a.aa.aaa.aaaa = aValue; state.b.bb.bbb.bbbb += bValue; };
const immerObjectGraphReducer = produce((state: TargetObjectGraph, aValue: string, bValue: number) => { state.a.aa.aaa.aaaa = aValue; state.b.bb.bbb.bbbb += bValue; });
const diagonObjectGraphReducer = makePatchRecorder((state: TargetObjectGraph, aValue: string, bValue: number) => { state.a.aa.aaa.aaaa = aValue; state.b.bb.bbb.bbbb += bValue; });

const propertySettingIterations = 10000;

suite = new Benchmark.Suite('Small object graph', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = createSmallObjectGraph();
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = nativeObjectGraphReducer(state, 'a', i);
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = createSmallObjectGraph();
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = immerObjectGraphReducer(state, 'a', i);
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = createSmallObjectGraph();
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = diagonObjectGraphReducer(state, 'a', i);
        }
    }, caseOptions)
    .run();

const target = {
    a: 1,
    b: 1,
    c: 1,
    // d: 1,
    // e: 1,
    // f: 1,
    // g: 1,
    // h: 1,
    // i: 1,
    // j: 1,
    // k: 1,
};

type Target = typeof target;

const nativePropertySettingReducer = (state: Target, property: keyof Target, value: number) => { state[property] += value; };
const immerPropertySettingReducer = produce((state: Target, property: keyof Target, value: number) => { state[property] += value; });
const diagonPropertySettingReducer = makePatchRecorder((state: Target, property: keyof Target, value: number) => { state[property] += value; });

suite = new Benchmark.Suite('Single object property setting', { ...suiteOptions, ...{} });
suite
    .add('Native', function () {
        const state = { ...target };
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = nativePropertySettingReducer(state, 'a', i);
        }
    }, caseOptions)
    .add('Immer', function () {
        const state = { ...target };
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = immerPropertySettingReducer(state, 'a', i);
        }
    }, caseOptions)
    .add('Diagon', function () {
        const state = { ...target };
        for (let i = 0; i < propertySettingIterations; i++) {
            const produced = diagonPropertySettingReducer(state, 'a', i);
        }
    }, caseOptions)
    .run();


function setSomeProperties(obj: any) {
    obj.a = 2;
    //obj.b = 2;
    obj.c = 2;
    obj.d = 2;
    //obj.e = 2;
    obj.f = 2;
    obj.g = 2;

    obj.i = 2;
}

//const contextForBasic = createContext();
const diagonProxy = createRecordingProxy({ ...target });
const simpleProxy = new Proxy({ ...target }, {});

//const contextForOverrides = createContext();
const diagonProxyWithOverrides = createRecordingProxy({ ...target });
setSomeProperties(diagonProxyWithOverrides);

const immerDraft = createDraft({ ...target });

const immerDraftWithOverrides = createDraft({ ...target });
setSomeProperties(immerDraftWithOverrides);

suite = new Benchmark.Suite('Drafts/proxies as source of copies', { ...suiteOptions, ...{} });
suite
    .add('Native POJO spread', function () {
        const copy = { ...target };
    }, caseOptions)
    .add('Minimal pass through proxy', function () {
        const copy = { ...simpleProxy };
    }, caseOptions)
    .add('Immer draft', function () {
        const copy = { ...immerDraft };
    }, caseOptions)
    .add('Immer draft with overrides', function () {
        const copy = { ...immerDraftWithOverrides };
    }, caseOptions)
    .add('Diagon proxy', function () {
        const copy = { ...diagonProxy };
    }, caseOptions)
    .add('Diagon proxy with overrides', function () {
        const copy = { ...diagonProxyWithOverrides };
    }, caseOptions)
    .run();