[![Build Status](https://img.shields.io/github/workflow/status/akutruff/diagon/tests?style=flat&colorA=000000&colorB=000000)](https://github.com/akutruff/diagon/actions?query=workflow%3Atest)
[![Build Size](https://img.shields.io/bundlephobia/minzip/diagon?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=diagon)
[![Version](https://img.shields.io/npm/v/diagon?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/diagon)
[![Downloads](https://img.shields.io/npm/dt/diagon.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/diagon)

# *Diagon*

State-management designed to minimize renders while staying out of your way and letting you write natural mutable code without sacrificing object references. 

```bash
npm install diagon diagon-react # core and react bindings
```


Full React sandbox [here](https://codesandbox.io/s/github/akutruff/diagon/tree/master/apps/cra) and sample app [here](https://akutruff.github.io/diagon)

#### Features

- [x] Object change recording
- [x] Mutable coding style 
- [x] Cyclic references
- [x] Multiple references to same object in state graph
- [x] Map, Set, and Array support
- [x] Async mutation with rendering control and state change control
- [x] Object property change subscriptions
- [x] Time travel and undo / redo built-in
- [x] React 18 support with useSyncExternalStore
- [x] React render batching
- [ ] React Concurrent Mode (may work but needs testing)


Diagon is designed to minimize component re-rendering as much as possible.  In general, almost all your components should be wrapped in `React.Memo` and use Diagon's hooks to determine when to trigger re-renders.

## Create a store

```typescript
import { createRecordingProxy } from 'diagon';
import { useRootState } from 'diagon-react';

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

  const subscriptionContextValue = useSubscriptionContextValue({ state, dispatch: () => { } });

  return (
    <SubscriptionContext.Provider value={subscriptionContextValue}>
      <Incrementor />
    </SubscriptionContext.Provider>
  );
};
```
Shows the typical pattern for subscribing to and mutating data while isolating the rendering behavior to just the affected data.  Uses `React.memo` to ensure complete isolation.

## The Recording Proxy
```typescript
import createRecordingProxy from 'diagon'

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

`createRecordingProxy()` wraps an object in a proxy that does two things: keep track of property assignments and wrap child objects in proxies when they are accessed.  This proxy is at the core of how diagon works.

Unlike many other state libraries, you can have multiple references to the same object in your state tree and it all just works automatically.  There's no more need for keeping a table of ids when you normally don't need it. 

As a rule, **you should always be using proxies** when dealing with your objects.  It's best to create a root state object and store all state there as is typical in state stores.  That way, as you access objects in the hierarchy they are automatically setup as proxies for change recording.  Note that you do not need a single state store.  Change tracking will totally work fine with independent trees of objects.

Note that some functions like `recordPatches()` will automatically ensure that a recording proxy exists or is created before calling your code. 

see [caveats](#caveats)

## `useRootState()`

Accesses the topmost state that you gave to the `SubscriptionContext.Provider` via `useSubscriptionContextValue`. 

It returns an untyped value, so it is a good idea to have a simple wrapper function around the hook that casts to your root type.

## `useSnaphot()` and Selectors

```typescript
const [name, age] = useSnapshot(person, person => [person.name, person.age]);
```

This is the main way to accomplish reactivity against your state.  The first parameter is the state you wish to observe, and the second parameter is a selector function.

In the above example, by accessing `person.name` and `person.age` in the selector, the component will rerender ONLY when the `name` or `age` properties change on the person object.  

The selector function is special.  When your component is mounted, this function is first used to record the properties you will be accessing from the subscribed state.  This is done by passing an empty proxy object as the parameter to selector you provide.  This means that you should not put any code that does any type of complex logic in the selector.  After the initial selector is run with a proxy, the selector is used with your real state to extract the values from the state.

After a change is detected in your subscriptions, the output of the selection is cached and re-rendering only happens if the value has changed.  The value change check is an object reference comparison, so you should generally wrap your selector in an array of outputs if you plan on return object references from your selector.  Without adding a wrapping 

There is an optional third parameter that allows you to pass a dependency list that will trigger a re-render and resubscribe to the object tree.  This is helpful for when you have a value from your component params that you wish to use to access your data, such as an id in a `Map` or array index. 

#### Deep values

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
Note that you can also make complicated chains.  Here, any property change on `state.person` will trigger a re-render as well as the subproperty `friend.name`.

### `elements()`
```typescript
const CollectionComponent : FC = React.memo(() => {
    const state = useAppState();
    const [people] = useSnapshot(state, state => [elements(state.people)]);
});
```
Subscribes to the collection as a whole and will re-render if an item is added or removed from the collection.  This should work for arrays, maps, and sets. **Maps and sets may currently have an issue that's being investigated.**

Not the selector is wrapped in an array. This is intentional since this selector returns a reference to the people object and selectors memoize output.  Without the wrapping array, the `CollectionComponent` would not re-render.

Note: if a property on a `Person` object inside the `people` array changes, it will **not** trigger a re-render of the component.  This is by design.

#### Subscribe to an array index
```typescript
const [name] = useSnapshot(state, state => [state.people[0].name]);
```
In the above example, the array index is respected.

```typescript
const NameComponent : FC<{index: number}> = ({index}) => {
    const state = useAppState();
    const [name] = useSnapshot(state, state => [state.people[index].name], [index]);
}
```

The selector depends on an external parameter that is not on the state object.  To make sure it resubscribes, pass in the parameters as a dependency like in typical react hooks

### `map_get()`

```typescript
const CollectionComponent : FC = () => {
    const state = useAppState();
    const [people] = useSnapshot(state, state => [map_get(state.myMap, "someKey")]);
}
```
To subscribe to changes in `Map<>` objects, you need to use the special `map_get` function to observe a particular key.

## `useProjectedSnapshot()`

```typescript
const PersonDetails : FC<{person: Person}> = React.memo(({person}) => {
    const state = useAppState();
    const isSelected = useProjectedSnapshot(state, state => state.selectedPerson, state => areSame(state.selectedPerson, person), [person]);
    return (
      {isSelected ? 'selected' : 'nope'}  
    );
});
```
Same usage as `useSnapshot` but allows you to add an additional projection function.  This function can arbitrary or complex values from your state, which is only executed when the object properties in your selector function change.  The result of the projection is memoized, so even if the properties in your selector function change, if the result of your projection equals the previous result, your component won't re-render!

In the example code, you could have 100 `PersonDetails` components on-screen, but only the previously selected component, and the newly selected component will re-render.  This is a great way to optimize the display of collections.

## `useMutator()`

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

## `useMutatorAsync()`
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
To support asynchronous loading and to control change-recording and as well as re-rendering, you use an async generator function with a passed in state.  At the begining of your mutator, you may modify your state and the rendering will not occur until you either `await` something or your function exits.

When you `await` inside your function, change recording stops at that moment.  When the await returns you may do additional `await` calls, but you must call `yield` prior to modifying your state.  Calling yield will begin change recording, and will again allow for re-rendering.

This may seem a bit cumbersome, but it allows you to completely control how a series of multiple async `awaits` can occur without affecting state until all is completed or successful 

Again, there is an optional dependency list parameter as well in order to use props inside your mutator function.

*Warning:* The following applies to any asynchronous code, not just Diagon. Be careful when using async functions with mutation! You could have multiple async functions executing, or simply some synchronous function modify state while your async process under way!  It is much better to make an object that represents your async call with local state on it that is unique per async operation.  That way if it gets replaced or invalidated you can ignore everything but the latest operation.  


### Nested Async Generators

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
# Change recording with patches

Diagon tracks which properties change as your code executes. These changes are stored in patches just like a git commit.

```typescript
import recordPatches from 'diagon'

const state = { counter: 0, otherCounter: 0 };
const patches = recordPatches(state, state => state.counter += 1);
// patches equals: [{"counter" => 0}]
```

Runs the increment function and records any object mutation into a list of `Map<>` objects containing the **original value** of each property.  

These patches allows you to rewind and undo changes by calling `applyPatch()`.

## Deep Object Hierarchies
```typescript

const bob = { favoriteFood: 'tacos' };
const alice = { favoriteFood: 'cake',  homie: bob };
const fred = { favoriteFood: 'pizza', homie: bob };

const state = { bob, alice, fred };

const patches = recordPatches(state, {alice, fred} => {
    alice.homie = fred;
    alice.homie.favoriteFood = 'nachos'; // Will now modify fred as you would expect.
    });

// patches equals: [{"homie" => bob}, {"favoriteFood" => 'pizza'}]
getPatchSource(patches[0]) // will equal alice
getPatchSource(patches[1]) // will equal fred

```

Runs the increment function and records any object mutation into a list of `Patch` objects that store which properties have changed and the **original value** of each property.  These patches allows you to rewind and undo changes by calling `applyPatch()`.

### Reverse a patch to go the opposite direction in history
```typescript
const reversePatch = createReversePatch(patches[0]);
// reverse patch: {"counter" => 1}
```

## Undo / Redo:
```typescript
const state = { counter: 0 };
const [ backwardsPatch ] = recordPatches(state, state => state.counter += 1);
//state equals {counter: 1}

const forwardPatch = createReversePatch(backwardsPatch);

//undo
applyPatch(backwardsPatch);
//state equals {counter: 0}

//redo
applyPatch(forwardPatch);
//state equals {counter: 1}

```

# Object proxy Utilities

### `isProxy(obj: any): boolean`

Returns whether `obj` is a reference to a recording proxy or not.

### `tryGetProxy<T>(obj: T): T | undefined`

Returns the current recording proxy for `obj` if one exists.  If `obj` is a reference to a proxy, then `obj` is returned.

### `ensureProxy<T extends object>(obj: T) : T`

If no recording proxy for `obj` exists, then one is created and returned.  If `obj` is a reference to a proxy, then `obj` is returned.

### `asOriginal<T>(obj: T): T`

If the `obj` parameter is a recording proxy, the underlying object being recorded is returned.  If `obj` is not a proxy, then `obj` is returned.

### `areSame(one: any, two: any): boolean`

Returns if one and two are the same object. If either object is a proxy, the underlying object is used for the comparison.  

Equivalent to `asOriginal(myObject) === asOriginal(otherObject)`

### `getPatchSource<T>(patch: InferPatchType<T>): T | undefined`

Returns the object from which the `patch` was calculated.

### `doNotTrack<T>(obj: T): T`

Disables proxy generation and change tracking for an object.  This is useful for when you store references to 3rd party instances in your state tree that  don't behave well when proxied.  

Untracked objects in your state tree will not return proxies from their child properties.

Untracked objects will behave differently with some utility functions which will treat the object as its own "proxy."
- `tryGetProxy` - will return the untracked object.
- `ensureProxy` - will return the untracked object, and no proxy will be generated.

`isProxy` will return false for untracked objects.

# Caveats

### Object Reference Comparison
Be weary of object reference comparisons as you may be trying to compare an original object with its proxy or vice versa. 

:x: `myObject === otherObject //either object could be a proxy!` 

:white_check_mark: `areSame(myObject, otherObject)` 

:white_check_mark: `asOriginal(myObject) === asOriginal(otherObject)` 

:white_check_mark: `ensureProxy(myObject) === ensureProxy(otherObject)` 

