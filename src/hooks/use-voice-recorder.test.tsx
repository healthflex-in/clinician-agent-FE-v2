import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceRecorder } from './use-voice-recorder';

const mocks = vi.hoisted(() => ({
  options: null as any, toast: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
  sendAudio: vi.fn(() => true), processTranscription: vi.fn(() => true),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/use-web-socket', () => ({ useWebSocket: (options: any) => {
  mocks.options = options;
  return { ...mocks, isConnected: true, isConnecting: false, isProcessing: false,
    transcription: '', suggestions: null, setSuggestions: vi.fn(), setTranscription: vi.fn() };
} }));

describe('AI response versus manual edits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps manual edits made while a recording is being processed', () => {
    let current = { plan: { advice: 'original' } };
    const update = vi.fn();
    const ref = { current: { getFormData: () => current, updateFormWithLLMData: update } };
    const { result } = renderHook(() => useVoiceRecorder({
      formKey: 'assessment', formData: current, formRendererRef: ref, microphonePermission: 'granted',
    }));
    act(() => result.current.handleAudioEncoded('YQ=='));
    current = { plan: { advice: 'manual correction' } };
    act(() => mocks.options.onFormData({ payloadType: 'structured', formData: { plan: { advice: 'AI change' } } }));
    expect(update).not.toHaveBeenCalled();
    expect(current.plan.advice).toBe('manual correction');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Form changed during processing' }));
  });

  it('applies the response when the form did not change', () => {
    const current = { plan: { advice: 'original' } };
    const update = vi.fn();
    const ref = { current: { getFormData: () => current, updateFormWithLLMData: update } };
    const { result } = renderHook(() => useVoiceRecorder({
      formKey: 'assessment', formData: current, formRendererRef: ref, microphonePermission: 'granted',
    }));
    act(() => result.current.handleAudioEncoded('YQ=='));
    const response = { payloadType: 'structured', formData: { plan: { advice: 'AI change' } } };
    act(() => mocks.options.onFormData(response));
    expect(update).toHaveBeenCalledExactlyOnceWith(response);
  });
});
