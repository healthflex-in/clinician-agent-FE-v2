import { describe, it, expect, vi } from 'vitest';
import { buildReportPayload, queueReportSave } from './report-payload';

describe('report payload', () => {
  it('saves descriptive First Assessment findings as comments and keeps sided numbers', () => {
    const form = { objectiveAssessment: { tests: [
      { testName: 'Right knee flexion', value: '130', right: '130', left: '' },
      { testName: 'Tenderness', value: 'Mild', right: 'Mild' },
      { testName: 'Squats', value: '3x10 @ 20kg', comments: 'RPE 7/10' },
    ] } };
    const rows = buildReportPayload('firstAssessment', form).firstAssessment.objectiveAssessments[0].tests;
    expect(rows[0]).toMatchObject({ value: 130, right: 130, left: null });
    expect(rows[1]).toMatchObject({ value: null, right: null, comments: 'value: Mild; right: Mild' });
    expect(rows[2]).toMatchObject({ value: null, comments: 'RPE 7/10; value: 3x10 @ 20kg' });
    expect(form.objectiveAssessment.tests[1].value).toBe('Mild');
  });
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
  it('preserves first-assessment goals, dates and recommendations for the dashboard adapter', () => {
    const result = buildReportPayload('firstAssessment', {
      subjectiveGoals: [{ goalDetails: 'Return to football', targetDate: '2027-03-01' }],
      objectiveGoals: [{
        goalName: 'Knee flexion', goalCategory: 'Range of Motion',
        unitName: 'degrees', value: '130', targetDate: '2026-11-01',
      }],
      recommendation: [{
        sessionType: 'Strength and Conditioning', sessionFrequency: '2 sessions per week',
      }],
    }).firstAssessment;

    expect(result.subjectiveGoals).toEqual([
      { goalDetails: 'Return to football', targetDate: '2027-03-01' },
    ]);
    expect(result.objectiveGoals[0]).toMatchObject({
      goalName: 'Knee flexion', value: '130', targetDate: '2026-11-01',
    });
    expect(result.recommendation).toEqual([{
      sessionType: 'Strength and Conditioning', sessionFrequency: '2 sessions per week',
    }]);
  });
  it('normalizes AI aliases and removes fields rejected by First Assessment GraphQL inputs', () => {
    const result = buildReportPayload('firstAssessment', {
      objectiveAssessment: { tests: [{
        name: 'Squats',
        details: '3 sets of 10 reps with 20 kg load',
        rpe: '7/10',
      }] },
      subjectiveAssessments: [{ description: 'Less pain compared to last week.' }],
    }).firstAssessment;

    expect(result.objectiveAssessments[0].tests[0]).toEqual({
      testName: 'Squats',
      comments: '3 sets of 10 reps with 20 kg load',
    });
    expect(result.subjectiveAssessments[0]).toEqual({
      conclusion: 'Less pain compared to last week.',
    });
    expect(result.objectiveAssessments[0].tests[0]).not.toHaveProperty('rpe');
    expect(result.subjectiveAssessments[0]).not.toHaveProperty('description');
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
  it('rejects negative repetitions, exercise load and duration but permits signed clinical measurements', () => {
    const assessment = (plan: any) => ({ plan: { plans: [plan] } });
    expect(() => buildReportPayload('assessment', assessment({
      set: [{ repetitions: -1, load: '20' }], duration: { value: 10 },
    }))).toThrow('Repetitions cannot be negative');
    expect(() => buildReportPayload('assessment', assessment({
      set: [{ repetitions: 10, load: '-5' }], duration: { value: 10 },
    }))).toThrow('Load cannot be negative');
    expect(() => buildReportPayload('assessment', assessment({
      set: [{ repetitions: 10, load: 'bodyweight' }], duration: { value: -2 },
    }))).toThrow('Duration cannot be negative');
    expect(buildReportPayload('assessment', {
      objectiveAssessment: { tests: [{ testName: 'Extension', value: -5, left: -3, right: -4 }] },
    }).assessment.objectiveAssessment.tests[0]).toMatchObject({ value: -5, left: -3, right: -4 });
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
