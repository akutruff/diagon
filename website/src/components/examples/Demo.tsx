import React, { FC } from 'react';

export const Demo: FC = ({ children }) => {
    return (
        <div className="demoBlock">
            {children}
        </div>
    );
};