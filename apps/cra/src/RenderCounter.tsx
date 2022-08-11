import { FC, useRef } from 'react';

export interface RenderCounterProps {
    label: string;
}
export const RenderCounter: FC<RenderCounterProps> = ({ label }) => {
    const renderCount = useRef(0);
    renderCount.current += 1;

    console.log(`rendering ${label}`);

    return (
        <div style={{ fontSize: '0.9rem' }}>render count: {renderCount.current}</div>
    );
};
