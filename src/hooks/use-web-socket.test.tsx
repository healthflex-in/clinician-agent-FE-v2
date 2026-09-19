import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebSocket } from './use-web-socket';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
const toast = vi.fn();

class FakeSocket {
  static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: any; onclose: any; onerror: any; onmessage: any;
  sent: any[] = [];
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  open() { this.readyState = 1; this.onopen?.({}); }
  close() { this.readyState = 3; this.onclose?.({}); }
  receive(data: any) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

describe('socket request lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal('WebSocket', FakeSocket); FakeSocket.instances = [];
    localStorage.clear(); toast.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('stays busy after transcription, delivers the form once, and ignores obsolete followups', () => {
    const onFormData = vi.fn();
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test/ws', onFormData }));
    act(() => { result.current.connect(); result.current.connect(); });
    expect(FakeSocket.instances).toHaveLength(1);
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    act(() => { expect(result.current.sendAudio('YQ==', { advice: 'test' })).toBe(true); });
    const requestId = socket.sent.at(-1).requestId;
    act(() => socket.receive({ requestId, payloadType: 'transcription', transcription: 'squats' }));
    expect(result.current.isProcessing).toBe(true);
    act(() => { expect(result.current.sendAudio('YQ==', {})).toBe(false); });
    act(() => socket.receive({ requestId, payloadType: 'structured', formData: { plan: {} } }));
    expect(result.current.isProcessing).toBe(false);
    expect(onFormData).toHaveBeenCalledTimes(1);
    act(() => result.current.processTranscription('change', { plan: {} }));
    act(() => socket.receive({ requestId, suggestions: ['obsolete'] }));
    expect(result.current.suggestions).toBeNull();
    expect(result.current.isProcessing).toBe(true);
  });

  it('normalizes older form_data messages and does not reconnect after deliberate close', async () => {
    const onFormData = vi.fn();
    const { result, unmount } = renderHook(() => useWebSocket({ url: 'ws://test/ws', onFormData }));
    act(() => result.current.connect());
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    act(() => socket.receive({ form_data: { plan: {} } }));
    expect(onFormData).toHaveBeenCalledWith(expect.objectContaining({ payloadType: 'structured', formData: { plan: {} } }));
    act(() => socket.close());
    act(() => result.current.disconnect());
    await act(() => vi.advanceTimersByTimeAsync(20000));
    expect(FakeSocket.instances).toHaveLength(1);
    unmount();
  });

  it('completes empty-audio requests without waiting for a form', () => {
    const { result } = renderHook(() => useWebSocket({ url: 'ws://test/ws' }));
    act(() => result.current.connect());
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    act(() => result.current.sendAudio('YQ==', {}));
    act(() => socket.receive({ transcription: '', processingComplete: true }));
    expect(result.current.isProcessing).toBe(false);
  });
});
