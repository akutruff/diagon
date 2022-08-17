/* eslint-disable @typescript-eslint/ban-types */

import { asOriginal, patchToTarget, recordPatches } from './diagon';
import { recordPath, PathRecord, MapKeys, AnyProperty } from './pathRecorder';
import { ArrayPatch, Patch, MapPatch } from './types';
import { Mutator } from '.';

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
    return {
    };
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

//TODO: rename to better associate to Subscriptions rather than "tracking patches" which is doesn't
export interface PatchTracker {
    version: number;
    rootNodes: Map<any, SubscriptionNodeData>;
    objectSubscriptions: Map<any, Set<SubscriptionNodeData>>;
}

export function createPatchTracker(): PatchTracker {
    return {
        version: 0,
        rootNodes: new Map<any, SubscriptionNodeData>(),
        objectSubscriptions: new Map<any, Set<SubscriptionNodeData>>(),
    };
}

//These method types are first defined on an interface so that they stay completely generic with no bound types.
//  Unfortunately, this is all basically partial function application, but variadic types aren't as general as we would like
//  https://github.com/microsoft/TypeScript/issues/39244 
interface IMutatorChangeRecorderTypes {
    mutatorChangeTrackingFactory: <TState extends object, TArgs extends unknown[], R = unknown>(mutator: Mutator<TState, TArgs, R>) => Mutator<TState, TArgs, void>;
    mutatorChangeRecorder: <TState extends object, TArgs extends unknown[], R = unknown>(tracker: PatchTracker, mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs) => void;
}

export type MutatorChangeRecorder = IMutatorChangeRecorderTypes['mutatorChangeRecorder'];
export type MutatorChangeRecorderFactory = IMutatorChangeRecorderTypes['mutatorChangeTrackingFactory'];

export const createChangeRecorderFactory = (patchTracker: PatchTracker, trackChanges: MutatorChangeRecorder): MutatorChangeRecorderFactory => {
    return mutator => (state, ...args) => trackChanges(patchTracker, mutator, state, ...args);
};

export function subscribeObject(tracker: PatchTracker, node: SubscriptionNodeData, objectToSubscribe: any) {
    if (node.subscribedObject === objectToSubscribe) {
        return;
    }
    unsubscribeObject(tracker, node);

    //TODO: verify what can be subscribed 
    if (!isSubscribable(objectToSubscribe)) {
        // console.log('cant subscribe to objectToSubscribe :>> ', objectToSubscribe);
        return;
    }

    // console.log('subscribing to :>> ', objectToSubscribe, isProxy(objectToSubscribe));
    //TODO: assert that the current node is not already assigned    
    node.subscribedObject = objectToSubscribe;

    let subscriptionNodesForObject = tracker.objectSubscriptions.get(objectToSubscribe);
    if (!subscriptionNodesForObject) {
        subscriptionNodesForObject = new Set();
        tracker.objectSubscriptions.set(objectToSubscribe, subscriptionNodesForObject);
    }
    subscriptionNodesForObject.add(node);

    //TODO: test this shit
    if (!node.parent) {
        const rootNode = tracker.rootNodes.get(objectToSubscribe);
        if (!rootNode) {
            console.log('UNEXPECTED !!! NO ROOT NODE');
            tracker.rootNodes.set(objectToSubscribe, node);
        }
    }
}

export function isSubscribable(objectToSubscribe: any) {
    return objectToSubscribe && (typeof objectToSubscribe === 'object' || isCollection(objectToSubscribe));
}

export function unsubscribeObject(tracker: PatchTracker, node: SubscriptionNodeData) {
    if (!node.subscribedObject)
        return;
    //TODO: assert that the current node is actually the subscribed node
    const subscribedNodes = tracker.objectSubscriptions.get(node.subscribedObject);
    if (subscribedNodes) {
        subscribedNodes.delete(node);
        if (subscribedNodes.size === 0) {
            tracker.objectSubscriptions.delete(node.subscribedObject);
        }
    }

    const rootNode = tracker.rootNodes.get(node.subscribedObject);
    if (node === rootNode) {
        tracker.rootNodes.delete(node.subscribedObject);
    }

    node.subscribedObject = undefined;
}

function addCallback(node: SubscriptionNodeData, callback: () => unknown) {
    if (!node.callbacks) node.callbacks = new Set();
    node.callbacks.add(callback);
}

function addPathToSubscriptions(tracker: PatchTracker, callback: () => unknown, currentPathRecord: PathRecord, currentSubscriptionNode: SubscriptionNodeData, currentValue: any, subscribedNodes: Set<SubscriptionNodeData> = new Set<SubscriptionNodeData>()) {
    const childPropertiesToMonitor = Reflect.ownKeys(currentPathRecord);

    if (childPropertiesToMonitor.length === 0) {
        subscribedNodes.add(currentSubscriptionNode);
        addCallback(currentSubscriptionNode, callback);
        // console.log('addding path :>> ', currentPathRecord, currentSubscriptionNode);
    } else {
        for (const propertyKey of childPropertiesToMonitor) {
            if (propertyKey === MapKeys) {
                // console.log('map Key :>> ', propertyKey);
                if (!currentSubscriptionNode.mapKeyValues) currentSubscriptionNode.mapKeyValues = new Map();
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
                    subscribeObject(tracker, childNode, valueForKey);

                    addPathToSubscriptions(tracker, callback, valuePathRecord as PathRecord, childNode, valueForKey, subscribedNodes);
                }
            } else {
                if (!currentSubscriptionNode.children) currentSubscriptionNode.children = new Map();
                const children = currentSubscriptionNode.children;
                let childNode = children.get(propertyKey);

                if (!childNode) {
                    childNode = createPropertyNode(currentSubscriptionNode, propertyKey);
                    children.set(propertyKey, childNode);
                }

                if (propertyKey === Symbol.iterator || propertyKey === AnyProperty) {
                    subscribedNodes.add(childNode);
                    addCallback(childNode, callback);
                } else {
                    // console.log('propertyName :>> ', propertyName);
                    const childPropertyValue = asOriginal(currentValue?.[propertyKey]);
                    subscribeObject(tracker, childNode, childPropertyValue);

                    addPathToSubscriptions(tracker, callback, (currentPathRecord as any)[propertyKey], childNode, childPropertyValue, subscribedNodes);
                }
            }
        }
    }
    return subscribedNodes;
}

export function subscribe<TState, R>(tracker: PatchTracker, state: TState, pathAccessor: (state: TState) => R, callback: () => void): Subscription {
    const originalState = asOriginal(state);
    const path = recordPath(pathAccessor);
    // console.log('subscribed path :>> ', path);

    let rootNode = tracker.rootNodes.get(originalState);
    if (!rootNode) {
        rootNode = createRootNode();
        tracker.rootNodes.set(originalState, rootNode);
        subscribeObject(tracker, rootNode, originalState);
    }

    const subscriptionNodesWithCallback = addPathToSubscriptions(tracker, callback, path, rootNode, originalState);

    return () => {
        for (const subscriptionNode of subscriptionNodesWithCallback) {
            // console.log('unsubscribed');            
            subscriptionNode.callbacks!.delete(callback);

            let nodeToCleanup: SubscriptionNodeData | undefined = subscriptionNode;

            while (nodeToCleanup && !nodeToCleanup.callbacks?.size && !nodeToCleanup.children?.size && !nodeToCleanup.mapKeyValues?.size) {
                // console.log('cleaning up :>> ', nodeToCleanup);
                unsubscribeObject(tracker, nodeToCleanup);
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
        // console.log('unsubbed :>> ', tracker, Array.from(subscriptionNodesWithCallback).map(x => x.callbacks));
    };
}

function getHighestCommonAncestors(nodes: Set<SubscriptionNodeData>) {
    const highestCommonAncestors = new Set<SubscriptionNodeData>();
    const visited = new WeakSet<any>();

    for (const node of nodes) {
        if (!visited.has(node)) {
            visited.add(node);
            let highest = node;
            let parent = node.parent;
            while (parent && !visited.has(parent)) {
                visited.add(parent);
                if (nodes.has(parent)) {
                    highest = parent;
                    if (highestCommonAncestors.has(parent)) {
                        break;
                    }
                }
                parent = parent.parent;
            }
            highestCommonAncestors.add(highest);
        }
    }
    return highestCommonAncestors;
}

function resubscribeAndGatherCallbacks(tracker: PatchTracker, currentSubscriptionNode: SubscriptionNodeData, newStateValue: any, callbacksToFire: Set<any>) {
    if (currentSubscriptionNode.callbacks) {
        for (const callback of currentSubscriptionNode.callbacks) {
            callbacksToFire.add(callback);
        }
    }

    subscribeObject(tracker, currentSubscriptionNode, newStateValue);

    const children = currentSubscriptionNode.children;
    if (children) {
        for (const childNode of children.values()) {
            resubscribeAndGatherCallbacks(tracker, childNode, newStateValue?.[childNode.propertyKey], callbacksToFire);
        }
    }

    const mapKeyValues = currentSubscriptionNode.mapKeyValues;
    if (mapKeyValues) {
        for (const valueNode of mapKeyValues.values()) {
            resubscribeAndGatherCallbacks(tracker, valueNode, newStateValue?.get(valueNode.key), callbacksToFire);
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

export function getCallbacksAndUpdateSubscriptionsFromPatches(tracker: PatchTracker, patches: Patch[]) {
    const invalidatedNodes = new Set<SubscriptionNodeData>();

    // console.log('publishing');
    for (const patch of patches) {
        // console.log('patch :>> ', patch);
        const patchTarget = patchToTarget.get(patch);
        const subscriptionNodes = tracker.objectSubscriptions.get(patchTarget);

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
                        for (const [changedPropertyName, patchValue] of (patch as Map<any, any> | ArrayPatch).entries()) {
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

    const highestInvalidatedNodesInTree = getHighestCommonAncestors(invalidatedNodes);

    const callbacksToFire = new Set<any>();
    for (const node of highestInvalidatedNodesInTree) {
        const currentStateValue = getValueFromParent(node);
        resubscribeAndGatherCallbacks(tracker, node, currentStateValue, callbacksToFire);
    }
    return callbacksToFire;
}

function isCollection(target: any) {
    return Array.isArray(target) || target instanceof Map || target instanceof Set;
}

//This is the simplest form of getting recordings and subscriptions.  Undo/redo history code would want to snap this function in the main application.
export function recordAndPublishMutations<TState extends object, TArgs extends unknown[], R>(tracker: PatchTracker, mutator: Mutator<TState, TArgs, R>, state: TState, ...args: TArgs) {
    const patches = recordPatches(mutator, state, ...args);

    const callbacksToFire = getCallbacksAndUpdateSubscriptionsFromPatches(tracker, patches);

    //TODO: add history support externally
    //for consumers to do their own change tracking

    //TODO: use Number.MAX_SAFE_INTEGER or BigInt
    tracker.version++;

    for (const callback of callbacksToFire) {
        callback();
    }
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
    tracker: PatchTracker,
    state: TState,
    childPathAccessor: (state: TState) => TChildState,
    subscribeToChildren: ChildSubscriberRecursive<TChildState>,
    callback: () => void): Subscription {

    let currentChildSubscriptions: SubscriptionCollection;
    let hasUnsubscribed = false;

    const subscribeWithTrackerAndCallback: GenericSelectSubscribeFunctionRecurse = (state, selector, subscribeToChildren?: ChildSubscriberRecursive<ReturnType<typeof selector>>) => {
        if (subscribeToChildren) {
            return subscribeRecursive(tracker, state, selector, subscribeToChildren, callback);
        } else {
            return subscribe(tracker, state, selector, callback);
        }
    };

    const resubscribeSubscription = subscribe(tracker, state, childPathAccessor, () => {
        if (hasUnsubscribed)
            return;

        //TODO: verify that this ordering is correct.  Subscribing to new values first and then unsubbing existing should keep 
        //   the subscription nodes from being created and destroyed when it's the same objects over and over.
        const selectedChild = childPathAccessor(state);
        const newChildSubscriptions = subscribeToChildren(selectedChild, subscribeWithTrackerAndCallback);

        unsubscribe(currentChildSubscriptions);
        currentChildSubscriptions = newChildSubscriptions;
    });

    const selectedChild = childPathAccessor(state);
    currentChildSubscriptions = subscribeToChildren(selectedChild, subscribeWithTrackerAndCallback);
    const executeCallbackSubscription = subscribe(tracker, state, childPathAccessor, callback);

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
    tracker: PatchTracker,
    state: TState,
    childPathAccessor: (state: TState) => TChildState,
    subscribeToChildren: (patchTracker: PatchTracker, selectedChild: TChildState, callback: () => void) => SubscriptionCollection,
    callback: () => void): Subscription {

    let currentChildSubscriptions: SubscriptionCollection;
    let hasUnsubscribed = false;

    const resubscribeSubscription = subscribe(tracker, state, childPathAccessor, () => {
        if (hasUnsubscribed)
            return;

        //TODO: verify that this ordering is correct.  Subscribing to new values first and then unsubbing existing should keep 
        //   the subscription nodes from being created and destroyed when it's the same objects over and over.
        const selectedChild = childPathAccessor(state);
        const newChildSubscriptions = subscribeToChildren(tracker, selectedChild, callback);

        unsubscribe(currentChildSubscriptions);
        currentChildSubscriptions = newChildSubscriptions;
    });

    const selectedChild = childPathAccessor(state);
    currentChildSubscriptions = subscribeToChildren(tracker, selectedChild, callback);
    const executeCallbackSubscription = subscribe(tracker, state, childPathAccessor, callback);

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
