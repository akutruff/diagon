/* eslint-disable @typescript-eslint/ban-types */
import { act, fireEvent, render, RenderOptions } from '@testing-library/react';
import { createRecordingProxy, map_get, resetEnvironment, subscribe, subscribeDeep } from 'diagon';
import { SubscribingRecorder } from 'packages/diagon/dist';
import React, { FC, PropsWithChildren, ReactElement, useRef } from 'react';
import { createReactRecorder, createReactStore, ReactStore, StoreContext, StoreContextValue, useDeepSnapshot, useMutator, useProjectedSnapshot, useSnapshot, useSubscribedSnapshot } from '.';

const SubscriptionApp: FC<PropsWithChildren<StoreContextValue>> = ({ children, state, recorder }) => {
    return (
        <StoreContext.Provider value={{ state, recorder }}>
            {children}
        </StoreContext.Provider>
    );
};

type RestOfRenderOptions = Omit<RenderOptions, 'wrapper'>;
const renderWithPatchTracking = (ui: ReactElement, storeContextValue: StoreContextValue, options?: RestOfRenderOptions) => {
    const rendered = render(ui, {
        wrapper: (props: any) => <SubscriptionApp {...props} {...storeContextValue} />,
        ...options,
    });
    return rendered;
};

describe('subscriptions', () => {
    let recorder: SubscribingRecorder;

    beforeEach(() => {
        resetEnvironment();
        recorder = createReactRecorder();
    });

    describe('useMutateWithPatches', () => {
        it.todo('is tested');
    });

    describe('useProjectedSnapshot', () => {
        it('updates when single property changes', async () => {
            const state = {
                count: 0,
            };
            type State = typeof state;

            createRecordingProxy(state);

            const increment = recorder.createMutator((state: State, value: number) => {
                state.count += value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                // console.log('renderCount :>> ', renderCount);
                const [ignore, count] = useProjectedSnapshot(state, stat => stat.count, (stat) => ['someRandomValue', stat.count]);
                expect(ignore).toEqual('someRandomValue');

                return (
                    <div>
                        <div>count: {count}</div>
                        <button onClick={() => increment(state, 1)}>increment</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('count: 0');
            expect(state.count).toEqual(0);
            expect(renderCount).toEqual(1);

            fireEvent.click(getByText('increment'));
            getByText('count: 1');
            expect(state.count).toEqual(1);
            expect(renderCount).toEqual(2);

            fireEvent.click(getByText('increment'));
            getByText('count: 2');
            expect(state.count).toEqual(2);
            expect(renderCount).toEqual(3);
        });
    });

    describe('useSnapshot', () => {
        it('updates when single property changes', async () => {
            const state = {
                count: 0,
            };
            type State = typeof state;

            createRecordingProxy(state);

            const increment = recorder.createMutator((state: State, value: number) => {
                state.count += value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const count = useSnapshot(state, state => state.count);
                return (
                    <div>
                        <div>count: {count}</div>
                        <button onClick={() => increment(state, 1)}>increment</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('count: 0');
            expect(state.count).toEqual(0);
            expect(renderCount).toEqual(1);
            // console.log('renderCount :>> ', renderCount);

            fireEvent.click(getByText('increment'));
            getByText('count: 1');
            expect(state.count).toEqual(1);
            expect(renderCount).toEqual(2);

            fireEvent.click(getByText('increment'));
            getByText('count: 2');
            expect(state.count).toEqual(2);
            expect(renderCount).toEqual(3);
        });

        it('updates when deep property changes', async () => {
            const state = {
                person: { name: 'bob' }
            };
            createRecordingProxy(state);
            type State = typeof state;

            const changeName = recorder.createMutator((state: State, value: string) => {
                state.person.name += value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const name = useSnapshot(state, state => state.person.name);
                return (
                    <div>
                        <div>name: {name}</div>
                        <button onClick={() => changeName(state, 'a')}>changeName</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name: bob');

            fireEvent.click(getByText('changeName'));
            getByText('name: boba');

            expect(renderCount).toBeGreaterThan(0);
        });

        it('updates when multiple properties are subscribed', async () => {
            const state = {
                person: { name: 'bob', address: { street: '123 Sycamore Lane' } },
            };
            createRecordingProxy(state);

            type State = typeof state;

            const changeName = recorder.createMutator((state: State, value: string) => {
                state.person.name += value;
            });

            const changeAddress = recorder.createMutator((state: State, value: string) => {
                state.person.address.street += value;
            });

            const setAddress = recorder.createMutator((state: State, value: State['person']['address']) => {
                state.person.address = value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const [name, street] = useSnapshot(state, state => [state.person.name, state.person.address.street]);
                return (
                    <div>
                        <div>name: {name}</div>
                        <div>address: {street}</div>
                        <button onClick={() => changeName(state, 'a')}>changeName</button>
                        <button onClick={() => changeAddress(state, 'b')}>changeAddress</button>
                        <button onClick={() => setAddress(state, { street: '9 14th St.' })}>setAddress</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name: bob');
            getByText('address: 123 Sycamore Lane');
            expect(renderCount).toEqual(1);
            fireEvent.click(getByText('changeName'));
            getByText('name: boba');
            getByText('address: 123 Sycamore Lane');

            fireEvent.click(getByText('changeAddress'));
            getByText('name: boba');
            getByText('address: 123 Sycamore Laneb');

            fireEvent.click(getByText('setAddress'));
            getByText('name: boba');
            getByText('address: 9 14th St.');

            expect(renderCount).toBeGreaterThan(0);
        });

        it('updates when map indicies change', async () => {
            const person0 = { name: 'bob' };
            const person1 = { name: 'jane' };
            const state = {
                peopleMap: new Map([['key0', person0], ['key1', person1]])
            };

            createRecordingProxy(state);
            type State = typeof state;

            const changeName = recorder.createMutator((state: State, key: string, value: string) => {
                expect(state.peopleMap.has(key)).toEqual(true);
                state.peopleMap.get(key)!.name += value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const [name0, name1] = useSnapshot(state, state => [map_get(state.peopleMap, 'key0')?.name, map_get(state.peopleMap, 'key1')?.name]);

                return (
                    <div>
                        <div>name0: {name0}</div>
                        <div>name1: {name1}</div>
                        <button onClick={() => changeName(state, 'key0', 'x')}>changeName0</button>
                        <button onClick={() => changeName(state, 'key1', 'y')}>changeName1</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name0: bob');
            getByText('name1: jane');

            fireEvent.click(getByText('changeName0'));
            getByText('name0: bobx');
            getByText('name1: jane');

            fireEvent.click(getByText('changeName1'));
            getByText('name0: bobx');
            getByText('name1: janey');

            //Expect that adding another value to the map that isn't monitored wont cause a re-render
            const previousRenderCount = renderCount;
            recorder.mutate(state, (state) => state.peopleMap.set('key3', { name: 'harry' }));

            expect(renderCount).toEqual(previousRenderCount);
        });

        it('updates when subscribed to entire collection changed', async () => {
            const person0 = { name: 'bob' };
            const person1 = { name: 'jane' };
            const state = {
                people: [person0, person1]
            };

            createRecordingProxy(state);
            type State = typeof state;

            const addPerson = recorder.createMutator((state: State, name: string) => {
                state.people.push({ name: name + state.people.length });
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const people = useSnapshot(state, state => [...state.people]);

                return (
                    <div>
                        <div>{people.map(p => <div key={p.name}>item: {p.name}</div>)}</div>
                        <button onClick={() => addPerson(state, 'person')}>addPerson</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('item: bob');
            getByText('item: jane');

            fireEvent.click(getByText('addPerson'));
            getByText('item: bob');
            getByText('item: jane');
            getByText('item: person2');

            expect(renderCount).toBeGreaterThan(0);
        });
    });

    describe('useDeepSnapshot', () => {
        it('updates when deep property changes', async () => {
            const state = {
                person: { name: 'bob' }
            };
            createRecordingProxy(state);
            type State = typeof state;

            const changeName = recorder.createMutator((state: State, value: string) => {
                state.person.name += value;
            });

            const changePerson = recorder.createMutator((state: State, value: string) => {
                state.person = { name: value };
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const name = useDeepSnapshot(
                    state,
                    state => state.person,
                    (subStore, person, callback) => subscribe(subStore, person, person => person.name, callback),
                    state => state.person.name);
                return (
                    <div>
                        <div>name: {name}</div>
                        <button onClick={() => changeName(state, 'a')}>changeName</button>
                        <button onClick={() => changePerson(state, 'steve')}>changePerson</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name: bob');

            fireEvent.click(getByText('changeName'));
            getByText('name: boba');

            fireEvent.click(getByText('changePerson'));
            getByText('name: steve');

            expect(renderCount).toBeGreaterThan(0);
        });
    });

    describe('useSubscribedSnapshot', () => {
        it('updates when only subscribed property changes', async () => {
            const state = {
                person: { name: 'bob' }
            };
            createRecordingProxy(state);
            type State = typeof state;

            const changeName = recorder.createMutator((state: State, value: string) => {
                state.person.name += value;
            });

            const changePerson = recorder.createMutator((state: State, value: string) => {
                state.person = { name: value };
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const name = useSubscribedSnapshot(
                    state,
                    (subStore, state, callback) => subscribe(subStore, state, state => state.person, callback),
                    state => state.person.name);
                return (
                    <div>
                        <div>name: {name}</div>
                        <button onClick={() => changeName(state, 'a')}>changeName</button>
                        <button onClick={() => changePerson(state, 'steve')}>changePerson</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name: bob');

            fireEvent.click(getByText('changeName'));
            //Notice that a change to name does not trigger an update since it is not subscribed to.
            getByText('name: bob');

            fireEvent.click(getByText('changePerson'));
            getByText('name: steve');

            expect(renderCount).toBeGreaterThan(0);
        });

        it('updates when nested subscriptions change', async () => {
            const state = {
                person: { name: 'bob' }
            };
            createRecordingProxy(state);
            type State = typeof state;

            const changeName = recorder.createMutator((state: State, value: string) => {
                state.person.name += value;
            });

            const changePerson = recorder.createMutator((state: State, value: string) => {
                state.person = { name: value };
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const name = useSubscribedSnapshot(
                    state,
                    (subStore, state, callback) => subscribeDeep(
                        subStore,
                        state,
                        state => state.person,
                        (subStore, person, callback) => subscribe(subStore, person, person => person.name, callback),
                        callback),
                    state => state.person.name);
                return (
                    <div>
                        <div>name: {name}</div>
                        <button onClick={() => changeName(state, 'a')}>changeName</button>
                        <button onClick={() => changePerson(state, 'steve')}>changePerson</button>
                    </div>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('name: bob');

            fireEvent.click(getByText('changeName'));
            getByText('name: boba');

            fireEvent.click(getByText('changePerson'));
            getByText('name: steve');

            expect(renderCount).toBeGreaterThan(0);
        });
    });

    describe('useMutator', () => {
        it('updates when single property changes', async () => {
            const state = {
                count: 0,
            };
            type State = typeof state;

            createRecordingProxy(state);

            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;
                const increment = useMutator(state, (state, value: number) => { state.count += value; });
                const count = useSnapshot(state, state => state.count);
                return (
                    <>
                        <div>count: {count}</div>
                        <button onClick={() => increment(1)}>increment</button>
                    </>
                );
            };

            const { getByText } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('count: 0');
            expect(state.count).toEqual(0);
            expect(renderCount).toEqual(1);

            fireEvent.click(getByText('increment'));
            getByText('count: 1');
            expect(state.count).toEqual(1);
            expect(renderCount).toEqual(2);
        });

        it('updates when state changes', async () => {
            const state = {
                count: 0,
            };
            createRecordingProxy(state);
            type State = typeof state;

            let instancesDetected = 0;
            let renderCount = 0;
            const TestComponent: FC<{ state: State }> = ({ state }) => {
                renderCount++;

                const instanceCheck = useRef(0);
                if (instanceCheck.current === 0) {
                    instancesDetected++;
                }

                // console.log('instanceCheck :>> ', instanceCheck.current);
                instanceCheck.current++;
                const increment = useMutator(state, (state, value: number) => { state.count += value; });

                const count = useSnapshot(state, state => state.count);
                return (
                    <div>
                        <div>count: {count}</div>
                        <button onClick={() => increment(1)}>increment</button>
                    </div>
                );
            };

            const { getByText, rerender } = renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            getByText('count: 0');
            expect(state.count).toEqual(0);
            expect(renderCount).toEqual(1);

            fireEvent.click(getByText('increment'));
            getByText('count: 1');
            expect(state.count).toEqual(1);
            expect(renderCount).toEqual(2);

            const newState: State = {
                count: 11001
            };

            createRecordingProxy(newState);

            rerender(<TestComponent state={newState} />);
            expect(renderCount).toEqual(3);

            fireEvent.click(getByText('increment'));
            getByText('count: 11002');
            expect(newState.count).toEqual(11002);
            expect(renderCount).toEqual(4);
            expect(instancesDetected).toEqual(1);
        });
    });

    interface MemoState {
        child: MemoChild;
    }

    interface MemoChild {
        status: string;
    }

    interface ParentOfMemoChildWithMemoProps {
        state: MemoState;
    }

    const ParentOfWeirdChildWithMemo = React.memo<ParentOfMemoChildWithMemoProps>(({ state }) => {
        const [childState] = useSnapshot(state, state => [state.child]);
        return (
            <div>
                <PassThroughWithMemo childState={childState} />
            </div>
        );
    });

    interface ChildWithMemoProps {
        childState: MemoChild;
    }

    const PassThroughWithMemo = React.memo<ChildWithMemoProps>(({ childState }) => {
        // console.log('ChildPasthrough render');
        return (
            <ChildWithMemo childState={childState} />
        );
    });

    const ChildWithMemo = React.memo<ChildWithMemoProps>(({ childState: weirdChild }) => {
        const [status] = useSnapshot(weirdChild, weirdChild => [weirdChild.status]);
        return (
            <div>
                {status}
            </div>
        );
    });

    describe('memoized componentents', () => {
        it('causes change', async () => {
            const state: MemoState = {
                child: {
                    status: 'a',
                }
            };
            createRecordingProxy(state);

            const externalMutator = recorder.createMutator((state: MemoState, value: string) => {
                state.child.status += value;
            });

            let renderCount = 0;
            const TestComponent: FC<{ state: MemoState }> = ({ state }) => {
                renderCount++;
                const increment = useMutator(state, (state) => { state.child.status += '_'; });

                return (
                    <div>
                        <div>count: 0</div>
                        <ParentOfWeirdChildWithMemo state={state} />
                        <button onClick={() => increment()}>increment</button>
                    </div>
                );
            };

            renderWithPatchTracking(<TestComponent state={state} />, { state, recorder });

            expect(renderCount).toEqual(1);

            await act(async () => {
                externalMutator(state, 'b');
            });

            expect(state.child.status).toEqual('ab');
        });
    });
});
