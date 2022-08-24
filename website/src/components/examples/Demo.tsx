import React, { FC } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export interface DemoProps {
    render: () => JSX.Element
}
export const Demo: FC<DemoProps> = ({ render }) => {
    return (
        <div className="demoBlock">
            <BrowserOnly fallback={<div>Loading...</div>}>
                {() => render()}
            </BrowserOnly>
        </div>
    );
};