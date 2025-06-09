import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Simple component to test
const TestComponent = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div>
      <div>Count: {count}</div>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

describe('Test Setup Verification', () => {
  test('should render and interact with component', async () => {
    const user = userEvent.setup();

    render(<TestComponent />);

    expect(screen.getByText('Count: 0')).toBeInTheDocument();

    const button = screen.getByText('Increment');
    await user.click(button);

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
