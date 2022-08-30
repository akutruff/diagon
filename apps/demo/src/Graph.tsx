import { areSame, elements } from 'diagon';
import { useMutator, useProjectionSnap, useSnap } from 'diagon-react';
import React, { CSSProperties, FC, useState } from 'react';
import { RenderCounter } from './RenderCounter';

export interface GraphNode {
    data: string,
    parent?: GraphNode,
    children: GraphNode[],
    id: number,
}

export interface GraphState {
    root: GraphNode,
    selectedNode?: GraphNode,
}

let nextId = 0;
function createNode(data: string, parent?: GraphNode) {
    const node = { parent, data, children: [], id: nextId++ };
    parent?.children.push(node);
    return node;
}

function createGraphState(): GraphState {
    const state = { root: createNode('root') };
    const one = createNode('one', state.root);
    createNode('two', state.root);
    createNode('three', one);
    createNode('four', one);

    return state;
}

interface GraphNodeComponentProps {
    node: GraphNode,
}

export const GraphNodeComponent: FC<GraphNodeComponentProps> = React.memo(({ node }) => {
    const [data, parentData, grandParent, children] = useSnap(node, node => [node.data, node.parent?.data, node.parent?.parent, elements(node.children)]);
    const isLastChild = useProjectionSnap(node,
        node => [node.data, elements(node.parent?.children)],
        node => areSame(node.parent?.children[node.parent?.children.length - 1], node));
    const onUp = useMutator(node, moveNodeUp);
    const onDown = useMutator(node, moveNodeDown);

    const childComponents = children.map(x =>
        <GraphNodeComponent key={x.id} node={x} />
    );

    return (
        <div style={nodeStyle}>
            <div>value: {data}</div>
            {parentData && <div>parent: {parentData}</div>}
            {node.parent &&
                <div>
                    <button disabled={!grandParent} onClick={onUp}>up</button>
                    <button disabled={isLastChild} onClick={onDown}>down</button>
                </div>
            }
            <RenderCounter label="<Graph/>" />
            <div style={{ display: 'flex', alignItems: 'top' }}>
                {childComponents}
            </div>
        </div>
    );
});

export const Graph: FC = React.memo(() => {
    const [state] = useState(() => createGraphState());
    // const onClick = useMutator(state, (state, node: GraphNode) => state.selectedNode = node);

    const root = useSnap(state, state => state.root);
    // const onClick = useMutator(root, moveNodeUp);

    return (
        <div style={style}>
            {<GraphNodeComponent node={root} />}
            {/* <button type="button" onClick={addPerson}>Add Person</button> */}
            <RenderCounter label="<Graph/>" />
        </div>
    );
});

const nodeStyle: CSSProperties = {
    padding: 10,
    display: 'inline-block',
    borderRadius: 10,
    color: 'black',
    backgroundColor: 'lightblue',
    borderStyle: 'solid',
};

const style: CSSProperties = {
    padding: 10,
    minWidth: 200,
    display: 'inline-block',
    borderRadius: 5,
    color: 'black',
    backgroundColor: 'lightgray'
};

const buttonFormStyle: CSSProperties = {
    display: 'flex',
    gap: 5
};

function moveNodeUp(node: GraphNode) {
    const grandParent = node.parent?.parent;
    const parent = node.parent;
    if (parent && grandParent) {
        const parentIndex = grandParent.children.findIndex(x => areSame(x, parent));
        const index = parent.children.findIndex(x => areSame(x, node));
        parent.children.splice(index, 1);
        grandParent.children.splice(parentIndex, 0, node);
        node.parent = grandParent;
        // console.log(asOriginal(node), asOriginal(parent), asOriginal(grandParent), parent.children.length);
    }
}

function moveNodeDown(node: GraphNode) {
    if (!node.parent || node.parent.children.length < 2)
        return;


    const parent = node.parent;
    const nodeIndex = parent.children.findIndex(x => areSame(x, node));

    if (nodeIndex === parent.children.length - 1)
        return;

    const newParent = parent.children[nodeIndex + 1];

    parent.children.splice(nodeIndex, 1);

    newParent.children.unshift(node);
    node.parent = newParent;
}
