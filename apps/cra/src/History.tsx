import { applyPatchTo, asOriginal, createReversePatch, createReversePatchFrom, elements, ensureProxy, getPatchSource, Patch } from 'diagon';
import { useMutator, useSnapshot } from 'diagon-react';
import React, { CSSProperties, FC } from 'react';
import { RootState, useAppState } from './app';

function mapToString<TKey, TValue>(map: Map<TKey, TValue>) {
    const obj = {} as any;

    for (const [key, value] of map.entries()) {
        obj[key] = value;
    }
    return JSON.stringify(obj);
}

function patchToString(patch: Patch) {
    // const target = getPatchSource(patch as any);
    if (patch instanceof Map) {
        return mapToString(patch);
    } else if (Array.isArray(patch)) {
        return JSON.stringify(patch);
    } else {
        return JSON.stringify(patch);
    }
}

export const globalHistoryMiddlware = (state: RootState, patches: Patch[]) => {
    const history = state.history;
    try {
        if (!history.isTimeTraveling) {
            if (history.timeTravelOffset < 0) {
                history.entries = history.entries.slice(0, history.timeTravelOffset);
            }
            history.entries.push({ back: patches });
            history.timeTravelOffset = 0;
        }
    }
    finally {
        state.history.isTimeTraveling = false;
    }
};

export const History: FC = React.memo(() => {
    const state = useAppState();

    const [entries, timeTravelOffset] = useSnapshot(state, state => [elements(state.history.entries), state.history.timeTravelOffset]);
    const currentHistoryIndex = entries.length + timeTravelOffset;

    const goBack = useMutator(state, ({ history }) => {
        history.isTimeTraveling = true;

        const currentHistoryIndex = history.entries.length + history.timeTravelOffset;

        const previousIndex = currentHistoryIndex - 1;

        if (previousIndex < 0) {
            return;
        }

        history.timeTravelOffset--;

        const entry = history.entries[previousIndex];
        const backPatches = entry.back.map(x => asOriginal(x));
        entry.forward ??= backPatches.map(patch => createReversePatchFrom(patch, getPatchSource(patch)));

        for (const patch of backPatches) {
            const patchTarget = getPatchSource(patch);
            applyPatchTo(patch, ensureProxy(patchTarget));
        }
    });

    const goForward = useMutator(state, ({ history }) => {
        history.isTimeTraveling = true;

        const currentHistoryIndex = history.entries.length + history.timeTravelOffset;

        if (currentHistoryIndex >= history.entries.length) {
            return;
        }

        history.timeTravelOffset++;

        const entry = history.entries[currentHistoryIndex];

        if (!entry.forward) {
            throw new Error('missing forward patches in history');
        }
        for (const patch of entry.forward) {
            const patchTarget = getPatchSource(patch);
            applyPatchTo(patch, ensureProxy(patchTarget));
        }
    });

    const seek = useMutator(state, ({ history }, newIndex: number) => {
        history.isTimeTraveling = true;

        const currentHistoryIndex = history.entries.length + history.timeTravelOffset;

        if (newIndex < currentHistoryIndex) {
            const iterations = currentHistoryIndex - newIndex;
            for (let i = 0; i < iterations; i++) {
                goBack();
            }
        } else if (newIndex > currentHistoryIndex) {
            const iterations = newIndex - currentHistoryIndex;
            for (let i = 0; i < iterations; i++) {
                goForward();
            }
        }
    });

    const historyElements = entries.map((entry, entryIndex) => {
        const items = entry.back.map((patch, patchIndex) => {
            return (
                <div key={patchIndex} style={{ display: 'inline-block' }}>
                    {patchToString(patch as any)}
                </div>
            );
        });

        // const selectionIndicatorStyle: CSSProperties = { width: '1em', backgroundColor: 'lightblue', visibility: entryIndex === currentHistoryIndex ? 'visible' : 'hidden' };
        return (
            <div key={entryIndex} style={{ ...historyElementContainerStyle, color: entryIndex === currentHistoryIndex ? 'lightblue' : 'white' }}>
                <div style={{ ...selectionIndicatorStyle, visibility: entryIndex === currentHistoryIndex ? 'visible' : 'hidden' }} />
                <div style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    [{items}]
                </div>
            </div>
        );
    });

    return (
        <div>
            <input type="range" min={0} max={state.history.entries.length} value={currentHistoryIndex} className="slider" onChange={(ev) => seek(Number.parseInt(ev.target.value))} />
            <button type="button" onClick={goBack} disabled={currentHistoryIndex === 0}>Undo</button>
            <button type="button" onClick={goForward} disabled={currentHistoryIndex >= entries.length}>Redo</button>
            <div>{currentHistoryIndex} / {entries.length}</div>
            {historyElements}
            <div style={{ ...historyElementContainerStyle, color: entries.length === currentHistoryIndex ? 'lightblue' : 'white' }}>
                <div style={{ ...selectionIndicatorStyle, visibility: entries.length === currentHistoryIndex ? 'visible' : 'hidden' }} />
                <div>
                    *present state*
                </div>
            </div>
        </div>
    );
});

const historyElementContainerStyle: CSSProperties = { display: 'flex', gap: 5, };
const selectionIndicatorStyle: CSSProperties = { width: '1em', backgroundColor: 'lightblue' };