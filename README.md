<!-- [![Build Status](https://img.shields.io/github/workflow/status/akutruff/dimmer/tests?style=flat&colorA=000000&colorB=000000)](https://github.com/akutruff/dimmer/actions?query=workflow%3Atest)
[![Build Size](https://img.shields.io/bundlephobia/minzip/@akutruff/dimmer?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=akutruff/dimmer)
[![Version](https://img.shields.io/npm/v/@akutruff/dimmer?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/akutruff/dimmer)
[![Downloads](https://img.shields.io/npm/dt/@akutruff/dimmer.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/akutruff/dimmer) -->

# *Dimmer*

State-management designed to minimize renders while stays out of your way and letting you write natural mutable code without comprimising object references. 

```bash
npm install @akutruff/dimmer @akutruff/dimmer-react # core and react bindings
```

Full React [example](apps/cra) with a [store](apps/cra/src/app/store.ts) and [components](apps/cra/src/App.tsx)

#### Features

- [x] Object change recording
- [x] Mutable coding style 
- [x] Async mutation with render control and commit control
- [x] Map, Set, and Array support
- [x] Object property change subscriptions
- [x] Time travel and undo / redo built-in
- [x] React 18 support
- [x] React render batching
- [ ] React Concurrent Mode (may work but needs testing)

# Change recording with patches

Everything in dimmer runs off tracking which properties change as your code executes. These changes are stored in patches just like a git commit.

```typescript
import recordPatches from '@akutruff/dimmer'

const state = { counter: 0, otherCounter: 0 };
const patches = recordPatches(state => state.counter += 1, state);
// patches equals: [{"counter" => 0}]
```

The above runs the increment function and records any object mutation into a list of `Map<>` objects that store which properties have changed and the **original value** of each property.  These patches allows you to rewind and undo changes by calling `applyPatch()`.

## Deep Object Hierarchies
```typescript

const bob = { favoriteFood: 'tacos' };
const alice = { favoriteFood: 'cake',  homie: bob };
const fred = { favoriteFood: 'pizza', homie: bob };

const state = { bob, alice, fred };

const patches = recordPatches({alice, fred} => {
    alice.homie = fred;
    alice.homie.favoriteFood = 'nachos'; // Will now modify fred as you would expect.
    }, state);

// patches equals: [{"homie" => bob}, {"favoriteFood" => 'pizza'}]
getPatchTarget(patches[0]) // will equal alice
getPatchTarget(patches[1]) // will equal fred

```

Runs the increment function and records any object mutation into a list of `Map<>` objects that store which properties have changed and the **original value** of each property.  These patches allows you to rewind and undo changes by calling `applyPatch()`.

### Reverse a patch to go the opposite direction in history
```typescript
const reversePatch = createReversePatch(changes[0]);
// reverse patch: {"counter" => 1}
```

## Undo / Redo:
```typescript
const state = { counter: 0 };
const patches = recordPatches(state => state.counter += 1, state);
//state equals {counter: 1}

const backwardsPatch = patches[0];
const forwardPatch = createReversePatch(patches[0]);

//undo
applyPatch(backwardsPatch);
//state equals {counter: 0}

//redo
applyPatch(forwardPatch);
//state equals {counter: 0}

```

```typescript
import recordPatches from '@akutruff/dimmer'

const state = { counter: 0, otherCounter: 0 };
const patches = recordPatches(state => state.counter += 1, state);
// patches equals: [{"counter" => 0}]
```

## The Recording Proxy
```typescript
import createRecordingProxy from '@akutruff/dimmer'

//Make a proxy for state
const state = createRecordingProxy({
        bob: {
            name: "Bob",
            age: 42
        },
        alice: {
            name: "Alice",
            age: 40
        }
    });

// The object returned is another recording proxy.
const bob = state.bob;
```

`createRecordingProxy()` wraps an object in a proxy that does two things: keep track of property assignments and wrap child objects in proxies when they are accessed.  This proxy is at the core of how dimmer works.

Unlike many other state libraries, you can have multiple references to the same object in your state tree and it all just works automatically.  There's no more need for keeping a table of ids when you normally don't need it. 

As a rule, **you should always be using proxies** when dealing with your objects.  It's best to create a root state object and store all state there as is typical in state stores.  That way, as you access objects in the hierarchy they are automatically setup as proxies for change recording.  Note that you do not need a single state store.  Change tracking will totally work fine with independent trees of objects.

Note that some functions like `recordPatches()` will automatically ensure that a recording proxy exists or is created before calling your code. 

see [caveats](#caveats)

# React 

## Create a store

```typescript
import createRecordingProxy from '@akutruff/dimmer'

export interface RootState {
    counter: number,
}

export function createRootState(): RootState {
    return createRecordingProxy({
        counter: 0
    });
}

```
`createRecordingProxy` returns a proxy wrapped object that now starts tracking **changes as patches** to your object.  

# Write code 
```typescript

export function createRootState(): RootState {
    return createRecordingProxy({
        counter: 0
    });
}
```

## Hooks

### useRootState()
### useSnaphot()
### useMutator()
### useMutatorAsync()

## Core

## Caveats

#### Object Reference Comparison
Be weary of object reference comparisons as you may be trying to compare an original object with its proxy or vice versa.

:x: `myObject === otherObject //either object could be a proxy!` 

:white_check_mark: `asOriginal(myObject) === asOriginal(otherObject)` 

:white_check_mark: `ensureProxy(myObject) === ensureProxy(otherObject)` 

