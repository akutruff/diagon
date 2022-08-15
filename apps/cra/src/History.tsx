import { applyPatchToProxy, asOriginal, createReversePatch, Patch } from 'diagon';
import { useMutator, usePatches, useSnapshot } from 'diagon-react';
import React, { FC } from 'react';
import { useAppState } from './app';

function mapToString<TKey, TValue>(map: Map<TKey, TValue>) {
    const obj = {} as any;

    for (const [key, value] of map.entries()) {
        obj[key] = value;
    }
    return JSON.stringify(obj);
}

function patchToString(patch: Patch) {
    // const target = getPatchTarget(patch as any);
    if (patch instanceof Map) {
        return mapToString(patch);
    } else if (Array.isArray(patch)) {
        return JSON.stringify(patch);
    } else {
        return JSON.stringify(patch);
    }
}

export const History: FC = React.memo(() => {
    const state = useAppState();

    usePatches(patches => {
        const { history } = state;
        if (!history.isTimeTraveling) {

            if (history.timeTravelOffset < 0) {
                history.entries = history.entries.slice(0, history.timeTravelOffset);
            }
            history.entries.push({ back: patches });
            history.timeTravelOffset = 0;
        }

        state.history.isTimeTraveling = false;
    }, [state, state.history]);


    const [timeTravelOffset] = useSnapshot(state, state => [state.history.timeTravelOffset]);

    const entries = state.history.entries;
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
        entry.forward ??= backPatches.map(patch => createReversePatch(patch));

        for (const patch of backPatches) {
            applyPatchToProxy(asOriginal(patch));
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
            applyPatchToProxy(asOriginal(patch));
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

        return (
            <div key={entryIndex} style={{ display: 'flex', gap: 5, color: entryIndex === currentHistoryIndex ? 'lightblue' : 'white' }}>
                <div style={{ width: '1em', backgroundColor: 'lightblue', visibility: entryIndex === currentHistoryIndex ? 'visible' : 'hidden' }} />
                <div>
                    [
                    {items}
                    ]
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
            <div style={{ display: 'flex', gap: 5, color: entries.length === currentHistoryIndex ? 'lightblue' : 'white' }}>
                <div style={{ width: '1em', backgroundColor: 'lightblue', visibility: entries.length === currentHistoryIndex ? 'visible' : 'hidden' }} />
                <div>
                    *present state*
                </div>
            </div>
        </div>
    );
});