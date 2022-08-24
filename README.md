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


Read the [Full Documenation](https://www.diagon.dev/)

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
