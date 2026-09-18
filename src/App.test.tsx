import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { submitFormData } from './utils/form-submission';
import { toast } from './hooks/use-toast';

vi.mock('./pages/Index', () => ({ default: () => <div>Clinician Agent</div> }));
vi.mock('./pages/not-found', () => ({ default: () => <div>Not found</div> }));

describe('visible save feedback', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('displays a notification after a confirmed save', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ data: { updateAgentReport: { _id: 'saved' } } }),
    }));
    render(<App />);
    await act(async () => {
      await submitFormData({ state: {}, appointmentId: 'visit', formKey: 'assessment',
        toast, setIsSubmitting: vi.fn() });
    });
    expect(screen.getByText('Form submitted successfully!')).toBeInTheDocument();
    expect(screen.getByText('Your form data has been saved.')).toBeInTheDocument();
  });
});
