import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitFormData } from './form-submission';
const request = vi.fn();
const response = (data: any) => ({ ok: true, json: async () => ({ data }) });

describe('save confirmation', () => {
  beforeEach(() => { request.mockReset(); vi.stubGlobal("fetch", request); });
  afterEach(() => vi.unstubAllGlobals());
  it('manual and automatic saves send identical payloads', async () => {
    request.mockResolvedValue(response({ updateAgentReport: { _id: 'saved' } }));
    const state = { rpe: { value: 0 }, plan: { advice: '', plans: [] } };
    const options = { state, appointmentId: 'test', formKey: 'assessment', toast: vi.fn(), setIsSubmitting: vi.fn() };
    expect(await submitFormData(options)).toBe(true);
    expect(await submitFormData({ ...options, isAutoSubmit: true })).toBe(true);
    const calls = request.mock.calls.map(call => JSON.parse(call[1].body).variables);
    expect(calls[0]).toEqual(calls[1]);
    expect(calls[0].input.assessment.rpe.value).toBe(0);
  });
  it('does not announce success when the server returns no report', async () => {
    request.mockResolvedValue(response({ updateAgentReport: null }));
    const toast = vi.fn(), loading = vi.fn();
    expect(await submitFormData({ state: {}, appointmentId: 'test', formKey: 'assessment', toast, setIsSubmitting: loading })).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Submission failed' }));
    expect(loading).toHaveBeenLastCalledWith(false);
  });
  it('rejects invalid measurements before making a request', async () => {
    expect(await submitFormData({ state: { rpe: { value: 20 } }, appointmentId: 'test', formKey: 'assessment', toast: vi.fn(), setIsSubmitting: vi.fn() })).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
});
