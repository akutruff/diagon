/* eslint-disable @typescript-eslint/ban-types */

import { asOriginal, patchToSource, recordPatches } from './diagon';
import { recordPath, PathRecord, MapKeys, AnyProperty } from './pathRecorder';
import { MapPatch, Mutator, Patch } from '.';

const propertyNodeType = 0;
const mapKeyValueNodeType = 1;

export interface SubscriptionNodeData {
    parent?: SubscriptionNodeData,
    subscribedObject?: object;
    children?: Map<PropertyKey, PropertyNode>;
    mapKeyValues?: Map<any, MapKeyValueNode>;
    callbacks?: Set<() => void>;
}

export interface PropertyNode extends SubscriptionNodeData {
    parent: SubscriptionNodeData,
    type: typeof propertyNodeType;
    propertyKey: PropertyKey;
}

export interface MapKeyValueNode extends SubscriptionNodeData {
    type: typeof mapKeyValueNodeType;
    parent: SubscriptionNodeData,
    key: any;
}

export type ChildNodeTypes = PropertyNode | MapKeyValueNode;

function createRootNode(): SubscriptionNodeData {
    return {};
}

function createPropertyNode(parent: SubscriptionNodeData, propertyKey: PropertyKey): PropertyNode {
    return {
        type: propertyNodeType,
        parent,
        propertyKey
    };
}

function createMapKeyValueNode(parent: SubscriptionNodeData, key: any): MapKeyValueNode {
    return {
        type: mapKeyValueNodeType,
        parent,
        key
    };
}

export interface SubscriptionStore {
    version: number;
    rootNodes: Map<any, SubscriptionNodeData>;
    objectSubscriptions: Map<any, Set<SubscriptionNodeData>>;
}

export function createSubscriptionStore(): SubscriptionStore {
    return {
        version: 0,
        rootNodes: new Map<any, SubscriptionNodeData>(),
        objectSubscriptions: new Map<any, Set<SubscriptionNodeData>>(),
    };
}

export const createPublishingMutator = <TState extends object, TArgs extends unknown[], R = unknown>(subStore: SubscriptionStore, mutator: Mutator<TState, TArgs, R>) => {
    return (state: TState, ...args: TArgs) => recordAndPublishPatches(subStore, state, mutator, ...args);
};

export function recordAndPublishPatches<TState extends object, TArgs extends unknown[], R>(subStore: SubscriptionStore, state: TState, mutator: Mutator<TState, TArgs, R>, ...args: TArgs) {
    const patches = recordPatches(state, mutator, ...args);

    const callbacksToFire = commitPatches(subStore, patches);

    subStore.version++;

    for (const callback of callbacksToFire) {
        callback();
    }
}

export function subscribeObject(subStore: SubscriptionStore, node: SubscriptionNodeData, objectToSubscribe: any) {
    if (node.subscribedObject === objectToSubscribe) {
        return;
    }
    unsubscribeObject(subStore, node);

    //TODO: verify what can be subscribed 
    if (!isSubscribable(objectToSubscribe)) {
        // console.log('cant subscribe to objectToSubscribe :>> ', objectToSubscribe);
        return;
    }

    // console.log('subscribing to :>> ', objectToSubscribe, isProxy(objectToSubscribe));
    //TODO: assert that the current node is not already assigned    
    node.subscribedObject = objectToSubscribe;

    let subscriptionNodesForObject = subStore.objectSubscriptions.get(objectToSubscribe);
    if (!subscriptionNodesForObject) {
        subscriptionNodesForObject = new Set();
        subStore.objectSubscriptions.set(objectToSubscribe, subscriptionNodesForObject);
    }
    subscriptionNodesForObject.add(node);

    //TODO: test this shit
    if (!node.parent) {
        const rootNode = subStore.rootNodes.get(objectToSubscribe);
        if (!rootNode) {
            console.log('UNEXPECTED !!! NO ROOT NODE');
            subStore.rootNodes.set(objectToSubscribe, node);
        }
    }
}

export function isSubscribable(objectToSubscribe: any) {
    return objectToSubscribe && (typeof objectToSubscribe === 'object' || isCollection(objectToSubscribe));
}

export function unsubscribeObject(subStore: SubscriptionStore, node: SubscriptionNodeData) {
    if (!node.subscribedObject)
        return;
    //TODO: assert that the current node is actually the subscribed node
    const subscribedNodes = subStore.objectSubscriptions.get(node.subscribedObject);
    if (subscribedNodes) {
        subscribedNodes.delete(node);
        if (subscribedNodes.size === 0) {
            subStore.objectSubscriptions.delete(node.subscribedObject);
        }
    }

    const rootNode = subStore.rootNodes.get(node.subscribedObject);
    if (node === rootNode) {
        subStore.rootNodes.delete(node.subscribedObject);
    }

    node.subscribedObject = undefined;
}

function addCallback(node: SubscriptionNodeData, callback: () => unknown) {
    if (!node.callbacks) node.callbacks = new Set();
    node.callbacks.add(callback);
}

function addPathToSubscriptions(
    subStore: SubscriptionStore,
    callback: () => unknown,
    currentPathRecord: PathRecord,
    currentSubscriptionNode: SubscriptionNodeData,
    currentValue: any,
    subscribedLeaves: Set<SubscriptionNodeData> = new Set<SubscriptionNodeData>()) {
    const childPropertiesToMonitor = Reflect.ownKeys(currentPathRecord);

    if (childPropertiesToMonitor.length === 0) {
        subscribedLeaves.add(currentSubscriptionNode);
        addCallback(currentSubscriptionNode, callback);
        // console.log('addding path :>> ', currentPathRecord, currentSubscriptionNode);
    } else {
        for (const propertyKey of childPropertiesToMonitor) {
            if (propertyKey === MapKeys) {
                // console.log('map Key :>> ', propertyKey);
                if (!currentSubscriptionNode.mapKeyValues) {
                    currentSubscriptionNode.mapKeyValues = new Map();
                }
                const keyValues = currentSubscriptionNode.mapKeyValues;
                for (const [key, valuePathRecord] of currentPathRecord[MapKeys]!) {
                    // console.log('[key, valuePathRecord] :>> ', [key, valuePathRecord]);
                    let childNode = keyValues.get(key);

                    if (!childNode) {
                        childNode = createMapKeyValueNode(currentSubscriptionNode, key);
                        keyValues.set(key, childNode);
                    }

                    // console.log('propertyName :>> ', propertyName);
                    const valueForKey = asOriginal(asOriginal(currentValue)?.get(key));
                    subscribeObject(subStore, childNode, valueForKey);

                    addPathToSubscriptions(subStore, callback, valuePathRecord as PathRecord, childNode, valueForKey, subscribedLeaves);
                }
            } else {
                if (!currentSubscriptionNode.children) {
                    currentSubscriptionNode.children = new Map();
                }
                const children = currentSubscriptionNode.children;
                let childNode = children.get(propertyKey);

                if (!childNode) {
                    childNode = createPropertyNode(currentSubscriptionNode, propertyKey);
                    children.set(propertyKey, childNode);
                }

                if (propertyKey === Symbol.iterator || propertyKey === AnyProperty) {
                    subscribedLeaves.add(childNode);
                    addCallback(childNode, callback);
                } else {
                    // console.log('propertyName :>> ', propertyName);
                    const childPropertyValue = asOriginal(currentValue?.[propertyKey]);
                    subscribeObject(subStore, childNode, childPropertyValue);

                    addPathToSubscriptions(subStore, callback, (currentPathRecord as any)[propertyKey], childNode, childPropertyValue, subscribedLeaves);
                }
            }
        }
    }
    return subscribedLeaves;
}

export function subscribe<TState, R>(subStore: SubscriptionStore, state: TState, pathAccessor: (state: TState) => R, callback: () => void): Subscription {
    const originalState = asOriginal(state);
    const path = recordPath(pathAccessor);
    // console.log('subscribed path :>> ', path);

    let rootNode = subStore.rootNodes.get(originalState);
    if (!rootNode) {
        rootNode = createRootNode();
        subStore.rootNodes.set(originalState, rootNode);
        subscribeObject(subStore, rootNode, originalState);
    }

    const subscriptionNodesWithCallback = addPathToSubscriptions(subStore, callback, path, rootNode, originalState);

    return () => {
        for (const subscriptionNode of subscriptionNodesWithCallback) {
            // console.log('unsubscribed');            
            subscriptionNode.callbacks!.delete(callback);

            let nodeToCleanup: SubscriptionNodeData | undefined = subscriptionNode;

            while (nodeToCleanup && !nodeToCleanup.callbacks?.size && !nodeToCleanup.children?.size && !nodeToCleanup.mapKeyValues?.size) {
                // console.log('cleaning up :>> ', nodeToCleanup);
                unsubscribeObject(subStore, nodeToCleanup);
                if (!nodeToCleanup.parent) {
                    break;
                }
                const childNode = (nodeToCleanup as ChildNodeTypes);
                switch (childNode.type) {
                    case propertyNodeType:
                        childNode.parent.children!.delete(childNode.propertyKey!);
                        break;
                    case mapKeyValueNodeType:
                        childNode.parent.mapKeyValues!.delete(childNode.key);
                        break;
                    default:
                        break;
                }

                nodeToCleanup = nodeToCleanup.parent;
            }
        }
        // console.log('unsubbed :>> ', subStore, Array.from(subscriptionNodesWithCallback).map(x => x.callbacks));
    };
}

function resubscribeAndGatherCallbacks(subStore: SubscriptionStore, currentSubscriptionNode: SubscriptionNodeData, newStateValue: any, callbacksToFire: Set<any>) {
    if (currentSubscriptionNode.callbacks) {
        for (const callback of currentSubscriptionNode.callbacks) {
            callbacksToFire.add(callback);
        }
    }

    subscribeObject(subStore, currentSubscriptionNode, newStateValue);

    const children = currentSubscriptionNode.children;
    if (children) {
        for (const childNode of children.values()) {
            resubscribeAndGatherCallbacks(subStore, childNode, newStateValue?.[childNode.propertyKey], callbacksToFire);
        }
    }

    const mapKeyValues = currentSubscriptionNode.mapKeyValues;
    if (mapKeyValues) {
        for (const valueNode of mapKeyValues.values()) {
            resubscribeAndGatherCallbacks(subStore, valueNode, newStateValue?.get(valueNode.key), callbacksToFire);
        }
    }
}

function getValueFromParent(node: SubscriptionNodeData) {
    if (!node.parent)
        throw Error('no parent for node');

    const childNode = (node as ChildNodeTypes);
    switch (childNode.type) {
        case propertyNodeType:
            return asOriginal(asOriginal((node.parent.subscribedObject as any))?.[childNode.propertyKey]);
        case mapKeyValueNodeType:
            return asOriginal(asOriginal((node.parent.subscribedObject as any))?.get(childNode.key));
        default:
            throw Error('unexpected node type');
    }
}

export function commitPatches(subStore: SubscriptionStore, patches: Patch[]) {
    const invalidatedNodes = new Set<SubscriptionNodeData>();

    // console.log('publishing');
    for (const patch of patches) {
        // console.log('patch :>> ', patch);
        const patchTarget = patchToSource.get(patch);
        const subscriptionNodes = subStore.objectSubscriptions.get(patchTarget);

        if (subscriptionNodes) {
            const isTargetCollection = isCollection(patchTarget);
            for (const subscriptionNode of subscriptionNodes) {

                if (isTargetCollection) {
                    const iteratorChild = subscriptionNode.children?.get(Symbol.iterator);
                    if (iteratorChild) {
                        // console.log('collection changed :>> ');
                        invalidatedNodes.add(iteratorChild);
                    }
                }

                if (subscriptionNode.mapKeyValues && patchTarget instanceof Map) {
                    for (const key of (patch as MapPatch<any, any>).keys()) {
                        const nodeForValue = subscriptionNode.mapKeyValues.get(key);
                        if (nodeForValue) {
                            invalidatedNodes.add(nodeForValue);
                        }
                    }
                } else if (subscriptionNode.children) {
                    //Symbol.iterator means the entire collection

                    //TODO: decide if it's generally better to scan over subscriptions or what's changed in the patch.

                    // for (const [propertyKey, childNode] of subscriptionNode.children) {
                    //     if (Reflect.has(patch, propertyKey!)) {
                    //         invalidatedNodes.add(childNode);
                    //     }
                    // }

                    let hasFoundChangedProperty = false;
                    if (patch instanceof Map) {
                        for (const [changedPropertyName, patchValue] of (patch as Map<any, any>).entries()) {
                            if (patchTarget[changedPropertyName] !== patchValue) {
                                hasFoundChangedProperty = true;
                                const nodeForProperty = subscriptionNode.children.get(changedPropertyName);
                                if (nodeForProperty) {
                                    invalidatedNodes.add(nodeForProperty);
                                }
                            }
                        }
                    } else {
                        for (const changedPropertyName in patch) {
                            if (patchTarget[changedPropertyName] !== (patch as any)[changedPropertyName]) {
                                hasFoundChangedProperty = true;
                                const nodeForProperty = subscriptionNode.children.get(changedPropertyName);
                                if (nodeForProperty) {
                                    invalidatedNodes.add(nodeForProperty);
                                }
                            }
                        }
                    }

                    if (hasFoundChangedProperty) {
                        const anyPropertyChangeNode = subscriptionNode.children.get(AnyProperty);
                        if (anyPropertyChangeNode) {
                            invalidatedNodes.add(anyPropertyChangeNode);
                        }
                    }
                }
            }
        }
    }

    const callbacksToFire = new Set<any>();
    for (const node of invalidatedNodes) {
        const currentStateValue = getValueFromParent(node);
        resubscribeAndGatherCallbacks(subStore, node, currentStateValue, callbacksToFire);
    }
    return callbacksToFire;
}

function isCollection(target: any) {
    return Array.isArray(target) || target instanceof Map || target instanceof Set;
}

export type Subscription = () => unknown;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface NestedArray<T> extends Array<NestedArray<T> | T> { }

export type SubscriptionCollection = Subscription | NestedArray<Subscription>;

export interface GenericSelectSubscribeFunction {
    <TState, TChildState>(state: TState, selector: (state: TState) => TChildState): SubscriptionCollection;
}

export interface GenericChildSubscriber {
    <TState>(state: TState, subscribe: GenericSelectSubscribeFunction): SubscriptionCollection;
}

export type ChildSubscriber<TState> = (state: TState, subscribe: GenericSelectSubscribeFunction) => SubscriptionCollection;

export interface GenericSelectSubscribeFunctionRecurse {
    <TState, TChildState>(state: TState, selector: (state: TState) => TChildState, subscribeToChildren?: ChildSubscriberRecursive<TChildState>): SubscriptionCollection;
}

export type ChildSubscriberRecursive<TState> = (state: TState, subscribe: GenericSelectSubscribeFunctionRecurse) => SubscriptionCollection;

export function subscribeRecursive<TState, TChildState>(
    subStore: SubscriptionStore,
    state: TState,
    childPathAccessor: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    callback: () => void): Subscription {

    let currentChildSubscriptions: SubscriptionCollection;
    let hasUnsubscribed = false;

    const subscribeWithStoreAndCallback: GenericSelectSubscribeFunctionRecurse = (state, selector, subscribeToChildren?: ChildSubscriberRecursive<ReturnType<typeof selector>>) => {
        if (subscribeToChildren) {
            return subscribeRecursive(subStore, state, selector, subscribeToChildren, callback);
        } else {
            return subscribe(subStore, state, selector, callback);
        }
    };

    const resubscribeSubscription = subscribe(subStore, state, childPathAccessor, () => {
        if (hasUnsubscribed)
            return;

        //TODO: verify that this ordering is correct.  Subscribing to new values first and then unsubbing existing should keep 
        //   the subscription nodes from being created and destroyed when it's the same objects over and over.
        const selectedChild = childPathAccessor(state);
        const newChildSubscriptions = subscribeToChildren(selectedChild, subscribeWithStoreAndCallback);

        unsubscribe(currentChildSubscriptions);
        currentChildSubscriptions = newChildSubscriptions;
    });

    const selectedChild = childPathAccessor(state);
    currentChildSubscriptions = subscribeToChildren(selectedChild, subscribeWithStoreAndCallback);
    const executeCallbackSubscription = subscribe(subStore, state, childPathAccessor, callback);

    return () => {
        if (hasUnsubscribed) {
            return;
        }
        hasUnsubscribed = true;
        unsubscribe(currentChildSubscriptions);
        resubscribeSubscription();
        executeCallbackSubscription();
    };
}

export function subscribeDeep<TState, TChildState>(
    subStore: SubscriptionStore,
    state: TState,
    childPathAccessor: (state: TState) => TChildState,
    subscribeToChildren: (subStore: SubscriptionStore, selectedChild: TChildState, callback: () => void) => SubscriptionCollection,
    callback: () => void): Subscription {

    let currentChildSubscriptions: SubscriptionCollection;
    let hasUnsubscribed = false;

    const resubscribeSubscription = subscribe(subStore, state, childPathAccessor, () => {
        if (hasUnsubscribed)
            return;

        //TODO: verify that this ordering is correct.  Subscribing to new values first and then unsubbing existing should keep 
        //   the subscription nodes from being created and destroyed when it's the same objects over and over.
        const selectedChild = childPathAccessor(state);
        const newChildSubscriptions = subscribeToChildren(subStore, selectedChild, callback);

        unsubscribe(currentChildSubscriptions);
        currentChildSubscriptions = newChildSubscriptions;
    });

    const selectedChild = childPathAccessor(state);
    currentChildSubscriptions = subscribeToChildren(subStore, selectedChild, callback);
    const executeCallbackSubscription = subscribe(subStore, state, childPathAccessor, callback);

    return () => {
        if (hasUnsubscribed) {
            return;
        }
        hasUnsubscribed = true;
        unsubscribe(currentChildSubscriptions);
        resubscribeSubscription();
        executeCallbackSubscription();
    };
}

export function unsubscribe(subscriptions: SubscriptionCollection) {
    if (!Array.isArray(subscriptions)) {
        subscriptions();
    } else {
        for (let i = 0; i < subscriptions.length; i++) {
            unsubscribe(subscriptions[i]);
        }
    }
}
