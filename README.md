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
- [x] React 18 support with useSyncExternalStore
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
const reversePatch = createReversePatch(patches[0]);
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
//state equals {counter: 1}

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

Dimmer is designed to minimize component re-rendering as much as possible.  In general, almost all your components should be wrapped in `React.Memo` and use dimmers hooks to determine when to trigger re-renders.

## Create a store

```typescript
import { createRecordingProxy } from '@akutruff/dimmer';
import { useRootState } from '@akutruff/dimmer-react';

export interface Person {
    id: number,
    name: string,
    age: number,

}

export interface RootState {
    selectedPerson: Person,
    people: Person[],
    counter: number,
}

export function useAppState() {
    return useRootState() as RootState;
}

export function createRootState() {
    const people = [
        { id: 0, name: 'Bob', age: 42 },
        { id: 1, name: 'Alice', age: 40 }
    ];

    return createRecordingProxy({
        selectedPerson: people[0],
        people,
        counter: 0
    });
}

```

`createRecordingProxy` returns a proxy wrapped object that now starts tracking **changes as patches** to your object.  

## Simple Counter App
```tsx
const Incrementor: FC = React.memo(() => {
  const state = useAppState();
  
  const counter = useSnapshot(state, state => state.counter);
  const increment = useMutator(state, state => state.counter++);

  return (
    <div>
      <div>value: {counter}</div>
      <button type="button" onClick={increment}>Click me</button>
    </div>
  );
});

const App: FC = () => {  
  const [state] = useState(() => createRootState());

  const patchTrackerContextValue = usePatchTrackerContextValue({ state, dispatch: () => { } });

  return (
    <PatchTrackerContext.Provider value={patchTrackerContextValue}>
      <Incrementor />
    </PatchTrackerContext.Provider>
  );
};
```
The above app is a simple counter that demonstrates the typical pattern for all data.  

## useRootState()

Accesses the topmost state that you gave to the `PatchTrackerContext.Provider` via `usePatchTrackerContextValue`. 

It returns an untyped value, so it is a good idea to have a simple wrapper function around the hook that casts to your root type.

## useSnaphot()

```typescript
const [name, age] = useSnapshot(person, person => [person.name, person.age]);
```

This is the main way to accomplish reactivity against your state.  The first parameter is the state you wish to observe, and the second parameter is a selector function.

In the above example, by accessing `person.name` and `person.age` in the selector, the component will rerender ONLY when the `name` or `age` properties change on the person object.  

The selector function is special.  When your component is mounted, this function is first used to record the properties you will be accessing from the subscribed state.  This is done by passing an empty proxy object as the parameter to selector you provide.  This means that you should not put any code that does any type of complex logic in the selector.  After the initial selector is run with a proxy, the selector is used with your real state to extract the values from the state.

Also, there is an optional third parameter that allows you to pass a dependency list that will trigger a re-render and resubscribe to the object tree.  This is helpful for when you have a value from your component params that you wish to use to access your data, such as an id in a `Map` or array index. 

### Deep values

```typescript
const [name] = useSnapshot(state, state => [state.person.friend.name]);
```
If any property value in the chain changes the component will re-render. This includes if `state.person` is reassigned.

### `all()`
```typescript
const [person] = useSnapshot(state, state => [all(state.person)]);
```
Subscribes to all property changes on the person object only.  Will re-render if any property on the person object changes.  

```typescript
const [value] = useSnapshot(state, state => [all(state.person).friend.name]);
```
Note that you can also make complicated chains.  In the above, any property change on `state.person` will trigger a re-render as well as the subproperty `friend.name`.

## Arrays index access
```typescript
const [name] = useSnapshot(state, state => [state.people[0].name]);
```
In the above example, the array indesx is respected.

```typescript
const NameComponent : FC<{index: number}> = ({index}) => {
    const state = useAppState();
    const [name] = useSnapshot(state, state => [state.people[index].name], [index]);
}
```

In the above example, the selector depends on an external parameter that is not on the state object.  To make sure it resubscribes, pass in the parameters as a dependency.

### `elements()`
```typescript
const CollectionComponent : FC = () => {
    const state = useAppState();
    const [people] = useSnapshot(state, state => [elements(state.people)]);
}
```
The above subscribes to the collection as a whole and will re-render if an item is added or removed from the collection.  This should work for arrays, maps, and sets. **Maps and sets may currently have an issue that's being investigated.**

Note: if a property inside the `people` array changes, it will **NOT** trigger a re-render of the component.  This is by design.

### `map_get()`

```typescript
const CollectionComponent : FC = () => {
    const state = useAppState();
    const [people] = useSnapshot(state, state => [map_get(state.myMap, "someKey")]);
}
```
To subscribe to changes in `Map<>` objects, you need to use the special `map_get` function to observe a particular key.

### useMutator()

```tsx
const state = useAppState();

const counter = useSnapshot(state, state => state.counter);
const increment = useMutator(state, state => state.counter++);

return (
    <div>
        <div>value: {counter}</div>
        <button type="button" onClick={increment}>Click me</button>
    </div>
);

```
Allows you to do mutations on your state and record any changes that happen.  No mutations should be done outside the passed in mutator function and if you need to use additional values from your component props, you should add the prop to the optional dependency list as the third argument to `useMutator`.

### useMutatorAsync()
```tsx
const state = useAppState();

const [isLoading, value] = useSnapshot(state, state => [state.isLoading, state.value]);

const loadWords = useMutatorAsync(state, async function* asyncFunction(state) {
    state.isLoading = true;
    const fetchedValue = await fetchSomething();
    yield; // starts the change recording process after any awaits 

    state.isLoading = false;
    state.value = fetchedValue;
});

useEffect(() => loadWords(), []);

return (
    <div>
        <div>isLoading: {isLoading}</div>
        <div>value: {value}</div>        
    </div>
);

```
To support asynchronous loading and to control when change-recording and prevent re-rendering, you use an async generator function with a passed in state.  At the begining of your mutator, you may modify your state and the rendering will not occur until you either `await` something or your function exits.

When you `await` inside your function, change recording stops at that moment.  When the await returns you may do additional `await` calls, but you must call `yield` prior to modifying your state.  Calling yield will begin change recording, and will again allow for re-rendering.

This may seem a bit cumbersome, but it allows you to completely control how a series of multiple async `awaits` can occur without affecting state until all is completed or successful 

Again, there is an optional dependency list parameter as well in order to use props inside your mutator function.

*Warning:* The following applies to any asynchronous code, not just Dimmer. Be careful when using async functions with mutation! You could have multiple async functions executing, or simply some synchronous function modify state while your async process under way!  It is much better to make an object that represents your async call with local state on it that is unique per async operation.  That way if it gets replaced or invalidated you can ignore everything but the latest operation.  


#### Nested Async Generators

```tsx
const state = useAppState();

const [isLoading, value] = useSnapshot(state, state => [state.isLoading, state.value]);

async function* myFetcher(state: State) {
    
    const fetchedValue = await fetchSomething();
    yield; // must yield because we awaited.

    state.prop0 = fetchedValue;
}

const loadWords = useMutatorAsync(state, async function* asyncFunction(state) {
    state.isLoading = true;
    
    yield* myFetcher(state);    
    yield; //caveat: You must yield in the caller after the nested function returns

    state.isLoading = false;    
});

useEffect(() => loadWords(), []);

```


## Caveats

#### Object Reference Comparison
Be weary of object reference comparisons as you may be trying to compare an original object with its proxy or vice versa.

:x: `myObject === otherObject //either object could be a proxy!` 

:white_check_mark: `asOriginal(myObject) === asOriginal(otherObject)` 

:white_check_mark: `ensureProxy(myObject) === ensureProxy(otherObject)` 

