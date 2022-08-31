[![Build Status](https://img.shields.io/github/workflow/status/akutruff/diagon/tests?style=flat&colorA=000000&colorB=000000)](https://github.com/akutruff/diagon/actions?query=workflow%3Atest)
[![Build Size](https://img.shields.io/bundlephobia/minzip/diagon?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=diagon)
[![Version](https://img.shields.io/npm/v/diagon?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/diagon)
[![Downloads](https://img.shields.io/npm/dt/diagon.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/diagon)

# *Diagon*

State-management designed to minimize renders while staying out of your way and letting you write natural mutable code without sacrificing object references. 

```bash
npm install diagon diagon-react # core and react bindings
```

Full React sandbox [here](https://stackblitz.com/github/akutruff/diagon/tree/master/apps/demo?file=src/Incrementor.tsx) and sample app [here](https://akutruff.github.io/diagon)


Read the [Full Documenation](https://www.diagon.dev/docs/intro)

### `diagon`

✅ Object change recording  
✅ Property change subscriptions  
✅ Mutable coding style  
✅ Object graphs with shared references  
✅ Cyclic references  
✅ Map, Set, and Array  
✅ Time travel with undo/redo built-in  
✅ Transparent to 3rd party libraries        

### `diagon-react`

✅ Re-renders components only if state changes  
✅ Prevents parent re-renders  
✅ Async mutation with rendering control  
✅ Allows almost all your components to be wrapped in `React.Memo`  
✅ React 18 support with useSyncExternalStore  
✅ Render batching  
⬛ Concurrent Mode (may work but needs testing)

## Library Comparison

This comparison strives to be as accurate and as unbiased as possible. If you use any of these libraries and feel the information could be improved, feel free to suggest changes.

| | [Diagon](https://github.com/akutruff/diagon) | [Immer](https://github.com/immerjs/immer) | [Zustand](https://github.com/pmndrs/zustand) | [<sup><sub>Zustand+Immer</sub></sup>](https://github.com/pmndrs/zustand#sick-of-reducers-and-changing-nested-state-use-immer) |
| --- | --- | --- | --- | --- |
| Object change tracking                                                  | ✅ | ✅ | ✅ | ✅ |
| Mutable coding style                                                    | ✅ | ✅ | 🟥 | ✅ |
| Object Patch Production                                                 | ✅ | ✅ | 🟥 | ✅ |
| Javascript references                                                   | ✅ | 🟥 | 🟥 | 🟥 |
| Object graphs with shared references                                    | ✅ | 🟥 | 🟥 | 🟥 |
| Cyclic references                                                       | ✅ | 🟥 | 🟥 | 🟥 |
| Mutable state                                                           | ✅ | 🟥 | 🟥 | 🟥 |
| Immutable state                                                         | 🟥 | ✅ | ✅ | ✅ |
| Rich query [selectors](/docs/react/use-snap#selector-paths)             | ✅ | 🟥 | 🟥 | 🟥 |
| Property change subscriptions                                           | ✅ | 🟥 | ✅ | ✅ |
| Async                                                                   | ✅ | ✅ | ✅ | ✅ |
| Map, Set, and Array                                                     | ✅ | ✅ | ✅ | ✅ |
| Time travel with undo/redo                                              | ✅ | ✅ | 🟥 | ✅ |
| Performance*                                                            | 2x-8x |  1x | TBD | TBD |

## React 

| | [Diagon](https://github.com/akutruff/diagon) | [Zustand](https://github.com/pmndrs/zustand) | 
| --- | --- | --- | 
| Re-renders components only if state changes                             | ✅ | ✅ | 
| Works with or without React Context                                     | ✅ | ✅ | 
| Patch recording hooks                                                   | ✅ | 🟥 | 


\*[Benchmark results here.](https://github.com/akutruff/diagon/blob/master/apps/benchmark-cli/latest-benchmark-results.txt) Diagon performs consistenly 2x-8x faster than Immer even without Immer patch support enabled.  Note, of course, that any benchmarks should simply be treated as a data point and will never be a substitue for real-world profiling. Suggestions and improvements to them are very welcome.  A React benchmark on [js-framework-bench](https://github.com/krausest/js-framework-benchmark) pull request is [pending](https://github.com/krausest/js-framework-benchmark/pull/1088).  

