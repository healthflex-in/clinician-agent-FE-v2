import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFormManagement } from './use-form-management';
import { createAgentReport, fetchFirstAssessmentReport } from '../utils/api';
const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('../utils/api', () => ({ createAgentReport: vi.fn(), fetchFirstAssessmentReport: vi.fn(async () => null), fetchUserById: vi.fn(async () => ({})) }));
vi.mock('@/utils/form-submission', () => ({ submitFormData: vi.fn() }));

describe('appointment initialization', () => {
  beforeEach(() => { vi.mocked(createAgentReport).mockReset(); vi.mocked(fetchFirstAssessmentReport).mockReset().mockResolvedValue(null); });
  it('ignores an old appointment response after navigation', async () => {
    let oldResponse!: (value: any) => void;
    vi.mocked(createAgentReport).mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve; }))
      .mockResolvedValueOnce({ createAgentReport: { _id: 'new-report', firstAssessment: { clinicalDetails: { chiefComplaint: 'new' } } } });
    const { result, rerender } = renderHook(useFormManagement, { initialProps: {
      patientId: 'patient', appointmentId: 'old', formKey: 'firstAssessment',
    }});
    await act(async () => { rerender({ patientId: 'patient', appointmentId: 'new', formKey: 'firstAssessment' }); });
    expect(result.current.reportId).toBe('new-report');
    await act(async () => { oldResponse({ createAgentReport: { _id: 'old-report', firstAssessment: {} } }); });
    expect(result.current.reportId).toBe('new-report');
    expect(result.current.formData.clinicalDetails.chiefComplaint).toBe('new');
  });
  it('loads an existing First Assessment without creating it again', async () => {
    vi.mocked(fetchFirstAssessmentReport).mockResolvedValue({ _id: 'existing', firstAssessment: {
      clinicalDetails: { chiefComplaint: 'Pain' }, objectiveAssessments: [{ tests: [{ value: 0 }] }],
    }});
    const { result } = renderHook(useFormManagement, { initialProps: {
      patientId: 'patient', appointmentId: 'appointment', formKey: 'firstAssessment',
    }});
    await act(async () => {});
    expect(createAgentReport).not.toHaveBeenCalled();
    expect(result.current.reportId).toBe('existing');
    expect(result.current.formData.objectiveAssessment.tests[0].value).toBe(0);
    expect(result.current.formData.objectiveAssessments).toBeUndefined();
  });

  it('clears prefetched fields and changes the renderer reset key', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(fetchFirstAssessmentReport).mockResolvedValue({ _id: 'existing', firstAssessment: {
      clinicalDetails: { chiefComplaint: 'Pain' }, objectiveAssessments: [{ tests: [{testName:'Old squat',value:20}] }],
    }});
    const { result } = renderHook(useFormManagement, { initialProps: {
      patientId:'patient', appointmentId:'appointment', formKey:'firstAssessment',
    }});
    await act(async () => {});
    act(() => { expect(result.current.handleFormReset()).toBe(true); });
    expect(result.current.resetVersion).toBe(1);
    expect(result.current.reportId).toBe('existing');
    expect(result.current.formData.clinicalDetails.chiefComplaint).toBe('');
    expect(result.current.formData.objectiveAssessment.tests[0].testName).toBe('');
    expect(result.current.formData.subjectiveAssessments[0].conclusion).toBe('');
    vi.unstubAllGlobals();
  });

  it('does not let a late prefetch undo reset', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    let resolve!: (value:any) => void;
    vi.mocked(fetchFirstAssessmentReport).mockImplementation(() => new Promise(done => { resolve=done; }));
    const { result } = renderHook(useFormManagement, { initialProps: {
      patientId:'patient',appointmentId:'appointment',formKey:'firstAssessment',
    }});
    act(() => { result.current.handleFormReset(); });
    await act(async () => { resolve({ _id:'existing',firstAssessment:{clinicalDetails:{chiefComplaint:'Old'}} }); });
    expect(result.current.formData.clinicalDetails.chiefComplaint).toBe('');
    expect(result.current.isInitialLoadComplete).toBe(true);
    vi.unstubAllGlobals();
  });

  it('clears immediately without depending on a browser dialog and supports Undo', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    vi.mocked(fetchFirstAssessmentReport).mockResolvedValue({ _id:'existing', firstAssessment:{clinicalDetails:{chiefComplaint:'Pain'}} });
    const { result } = renderHook(useFormManagement, { initialProps:{patientId:'p',appointmentId:'a',formKey:'firstAssessment'} });
    await act(async () => {});
    act(() => { expect(result.current.handleFormReset()).toBe(true); });
    expect(confirm).not.toHaveBeenCalled();
    expect(result.current.formData.clinicalDetails.chiefComplaint).toBe('');
    const resetToast = toast.mock.calls.filter(([arg]) => arg.title === 'Form Reset').at(-1)![0];
    act(() => resetToast.action.props.onClick());
    expect(result.current.formData.clinicalDetails.chiefComplaint).toBe('Pain');
    vi.unstubAllGlobals();
  });

});
