import React from 'react';
import { Button } from '@akutruff/components/button';
import { meaningOfLife } from '@akutruff/foo';
import { useTest } from '@hooks/test';

export const App = () => {
  useTest();

  return (
    <div>
      {meaningOfLife}
      <Button />
    </div>
  );
};
