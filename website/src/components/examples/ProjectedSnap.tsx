import { createReactRecorder } from 'diagon-react';
import React, { FC, memo } from 'react';

const { useProjectedSnap } = createReactRecorder();

const state = {
    name: 'Bob',
    numberOfVisits: 0
};

export const LoyaltyDisplay: FC = memo(() => {
    const isFrequentVisitor = useProjectedSnap(
        state,
        state => state.numberOfVisits,
        state => state.numberOfVisits > 10);
    return (
        <div>Is frequent visitor: {isFrequentVisitor}</div>
    );
});