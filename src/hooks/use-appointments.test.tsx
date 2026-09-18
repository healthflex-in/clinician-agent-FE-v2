import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppointments } from './use-appointments';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), toast: vi.fn() }));
vi.mock('@/utils/graphql-client', () => ({ fetchAppointments: mocks.fetch }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
const report = (id: string, date: string) => ({ _id: `report-${id}`, appointment: {
  _id: id, seqNo: id, event: { startTime: date, endTime: date },
} });
describe('appointment selection', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
  it('accepts the first manual change after automatically selecting the latest visit', async () => {
    mocks.fetch.mockResolvedValue({ reports: [report('older', '2026-09-01'), report('latest', '2026-09-18')] });
    const { result } = renderHook(() => useAppointments('patient'));
    await waitFor(() => expect(result.current.appointmentId).toBe('latest'));
    act(() => result.current.handleAppointmentChange('older'));
    expect(result.current.appointmentId).toBe('older');
  });
  it('ignores an old patient response after switching patients', async () => {
    let resolveOld!: (data: any) => void;
    mocks.fetch.mockImplementation((id: string) => id === 'old'
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ reports: [report('new-visit', '2026-09-18')] }));
    const { result, rerender } = renderHook(({ id }) => useAppointments(id), { initialProps: { id: 'old' } });
    rerender({ id: 'new' });
    await waitFor(() => expect(result.current.appointmentId).toBe('new-visit'));
    await act(async () => resolveOld({ reports: [report('old-visit', '2026-09-01')] }));
    expect(result.current.appointmentId).toBe('new-visit');
  });
});
