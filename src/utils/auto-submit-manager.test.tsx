import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSubmitManager, AutoSubmitManagerProps } from './auto-submit-manager';
import { submitFormData } from './form-submission';

vi.mock('./form-submission', () => ({ submitFormData: vi.fn(async () => true) }));

const props = (): AutoSubmitManagerProps => ({
  autoSubmitOnLLMUpdate: true, autoSubmitDelay: 3000, isInitialized: true,
  state: { plan: { advice: 'first' } }, appointmentId: 'appointment-a',
  toast: vi.fn(), setIsSubmitting: vi.fn(),
});

describe('automatic report saves', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.mocked(submitFormData).mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('honors the configured delay and reads the latest state', async () => {
    const initial = props();
    const { result, rerender } = renderHook(useAutoSubmitManager, { initialProps: initial });
    act(() => result.current.triggerAutoSubmit());
    rerender({ ...initial, state: { plan: { advice: 'latest' } } });
    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(submitFormData).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(submitFormData).toHaveBeenCalledOnce();
    expect(submitFormData).toHaveBeenCalledWith(expect.objectContaining({ state: { plan: { advice: 'latest' } } }));
  });

  it('cancels on user edit and on unmount', async () => {
    const { result, unmount } = renderHook(useAutoSubmitManager, { initialProps: props() });
    const edit = vi.fn();
    act(() => { result.current.triggerAutoSubmit(); result.current.handleUserChange('plan.advice', 'manual', edit); });
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(edit).toHaveBeenCalledWith('plan.advice', 'manual');
    expect(submitFormData).not.toHaveBeenCalled();
    act(() => result.current.triggerAutoSubmit());
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(submitFormData).not.toHaveBeenCalled();
  });

  it('debounces consecutive AI updates and cancels after switching appointments', async () => {
    const initial = props();
    const { result, rerender } = renderHook(useAutoSubmitManager, { initialProps: initial });
    act(() => result.current.triggerAutoSubmit());
    await act(() => vi.advanceTimersByTimeAsync(2000));
    act(() => result.current.triggerAutoSubmit());
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(submitFormData).not.toHaveBeenCalled();
    rerender({ ...initial, appointmentId: 'appointment-b' });
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(submitFormData).not.toHaveBeenCalled();
  });

  it('serializes saves and does not run a cancelled save waiting for an earlier request', async () => {
    let release!: (value: boolean) => void;
    vi.mocked(submitFormData).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const { result } = renderHook(useAutoSubmitManager, { initialProps: props() });
    act(() => result.current.triggerAutoSubmit());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    act(() => result.current.triggerAutoSubmit());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(submitFormData).toHaveBeenCalledOnce();
    act(() => result.current.cancelAutoSubmit());
    await act(async () => { release(true); });
    expect(submitFormData).toHaveBeenCalledOnce();
  });
  it('cancels a pending save when changing form type in the same appointment', async () => {
    const initial = { ...props(), formKey: 'assessment' };
    const { result, rerender } = renderHook(useAutoSubmitManager, { initialProps: initial });
    act(() => result.current.triggerAutoSubmit());
    rerender({ ...initial, formKey: 'firstAssessment' });
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(submitFormData).not.toHaveBeenCalled();
  });

});
