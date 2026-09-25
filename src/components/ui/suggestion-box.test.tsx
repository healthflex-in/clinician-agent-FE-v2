import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SuggestionBox from './suggestion-box';

describe('clarification banner', () => {
  it('displays the backend question array', () => {
    render(<SuggestionBox suggestions={['Which side was measured?']} onClose={vi.fn()} autoCloseDelay={0} />);
    expect(screen.getByText('Which side was measured?')).toBeInTheDocument();
    expect(screen.queryByText('No suggestions available')).not.toBeInTheDocument();
  });
  it('hides an empty backend response', () => {
    const { container } = render(<SuggestionBox suggestions={[]} onClose={vi.fn()} autoCloseDelay={0} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('still reads older JSON strings', () => {
    render(<SuggestionBox suggestions={'["Which test?"]'} onClose={vi.fn()} autoCloseDelay={0} />);
    expect(screen.getByText('Which test?')).toBeInTheDocument();
  });
});
