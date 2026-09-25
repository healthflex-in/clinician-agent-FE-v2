/** Current renderer integration tests. Historical per-row recorder suite is archived.
 * Audio lifecycle is covered by use-web-socket/use-voice-recorder source tests.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormRenderer from '../src/components/forms/form-renderer';

const snc = { plans: [{ exercise: 'Squats', comments: '', set: [{ repetitions: 10, load: '20', unit: 'kg' }] }] };
const physio = { tests: [{ testName: 'ROM', unitName: 'degrees', value: 17.5, left: 0, right: 20, comments: '' }] };
const base = { isWebSocketConnected: true, recordingMode: 'idle' as const, autoSubmitOnLLMUpdate: false };

describe('Current SNC and physio renderer', () => {
  it('renders existing exercise data and forwards manual edits', () => {
    const onChange = vi.fn();
    render(<FormRenderer {...base} schema={snc} formData={snc} formKey="snc" onChange={onChange} />);
    expect(screen.getByDisplayValue('Squats')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/enter exercise/i), { target: { value: 'Lunges' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ plans: expect.arrayContaining([expect.objectContaining({ exercise: 'Lunges' })]) }));
  });
  it('adds an exercise row without overwriting an existing row', () => {
    const onChange = vi.fn();
    render(<FormRenderer {...base} schema={snc} formData={snc} formKey="snc" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Add Plan$/i }));
    expect(screen.getAllByPlaceholderText(/enter exercise/i)).toHaveLength(2);
    expect(screen.getByDisplayValue('Squats')).toBeInTheDocument();
    expect(onChange.mock.calls.at(-1)?.[0].plans).toHaveLength(2);
  });
  it('renders zero and decimal measurements and forwards edits', () => {
    const onChange = vi.fn();
    render(<FormRenderer {...base} schema={physio} formData={physio} formKey="physio" onChange={onChange} />);
    expect(screen.getByPlaceholderText(/enter left/i)).toHaveValue(0);
    expect(screen.getByPlaceholderText(/enter value/i)).toHaveValue(17.5);
    fireEvent.change(screen.getByPlaceholderText(/enter comments/i), { target: { value: 'Improving' } });
    expect(onChange.mock.calls.at(-1)?.[0].tests[0].comments).toBe('Improving');
  });
  it('adds and removes a test without corrupting the retained measurement', () => {
    render(<FormRenderer {...base} schema={physio} formData={physio} formKey="physio" />);
    fireEvent.click(screen.getByRole('button', { name: /Add Test$/i }));
    expect(screen.getAllByPlaceholderText(/enter test name/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
    expect(screen.getAllByPlaceholderText(/enter test name/i)).toHaveLength(1);
    expect(screen.getByDisplayValue('ROM')).toBeInTheDocument();
  });
});
