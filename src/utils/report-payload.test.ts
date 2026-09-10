import { describe, it, expect, vi } from 'vitest';
import { buildReportPayload, queueReportSave } from './report-payload';

describe('report payload', () => {
  it('preserves zeros, explicit clears and decimal measurements without changing the form', () => {
    const form = { rpe: { value: 0, record: 'private' }, plan: { advice: '', plans: [] }, objectiveAssessment: {
      tests: [{ testName: 'ROM', unitName: 'degrees', value: '17.5', left: '', right: 0 }],
    }};
    const payload = buildReportPayload('assessment', form).assessment;
    expect(payload.rpe).toEqual({ value: 0 });
    expect(payload.plan).toEqual({ advice: '', plans: [] });
    expect(payload.objectiveAssessment.tests[0]).toMatchObject({ value: 17.5, left: null, right: 0 });
    expect(form.objectiveAssessment.tests[0].value).toBe('17.5');
  });
  it('maps first-assessment objective sections and preserves other sections', () => {
    const result = buildReportPayload('firstAssessment', {
      clinicalDetails: { chiefComplaint: 'Pain' }, subjectiveAssessments: [], objectiveAssessment: { tests: [] },
    }).firstAssessment;
    expect(result.objectiveAssessments).toEqual([{ tests: [] }]);
    expect(result.objectiveAssessment).toBeUndefined();
    expect(result.clinicalDetails.chiefComplaint).toBe('Pain');
  });
  it('does not silently save SNC/physio as assessment', () => {
    expect(buildReportPayload('snc', { plans: [{ set: [{ load: 20 }] }] })).toEqual({ snc: { plans: [{ set: [{ load: '20' }] }] } });
    expect(buildReportPayload('physio', { tests: [] })).toEqual({ physio: { tests: [] } });
    expect(() => buildReportPayload('unknown', {})).toThrow();
  });
  it('rejects invalid measurements and out-of-range RPE', () => {
    expect(() => buildReportPayload('assessment', { rpe: { value: 11 } })).toThrow();
    expect(() => buildReportPayload('physio', { tests: [{ value: 'bad' }] })).toThrow();
  });
  it('orders saves for one appointment and recovers after failure', async () => {
    let reject!: (error: Error) => void;
    const first = queueReportSave('test', () => new Promise((_, fail) => { reject = fail; }));
    const checked = expect(first).rejects.toThrow('failed');
    const save = vi.fn(async () => 'saved');
    const second = queueReportSave('test', save);
    await Promise.resolve(); await Promise.resolve();
    expect(save).not.toHaveBeenCalled();
    reject(new Error('failed'));
    await checked;
    await expect(second).resolves.toBe('saved');
  });
});
