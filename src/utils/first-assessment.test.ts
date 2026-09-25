import { describe, expect, it } from 'vitest';
import { assessmentToForm, firstAssessmentToForm, hasPersistedAgentChanges } from './first-assessment';
import { buildReportPayload } from './report-payload';

describe('first assessment round trip', () => {
  it('restores a saved follow-up Agent edit before dashboard records', () => {
    const report = { version: 2, assessment: {
      plan: { advice: 'Updated advice', plans: [{ exercise: 'Squat', set: [{ repetitions: 8 }] }] },
      subjectiveAssessment: { assessment: 'Updated symptom' },
      objectiveAssessment: { tests: [{ testName: 'ROM', right: 130 }] }, rpe: { value: 0 },
    } };
    expect(hasPersistedAgentChanges(report)).toBe(true);
    expect(assessmentToForm(report.assessment)).toMatchObject(report.assessment);
  });
  it('uses records only for a newly-created blank Agent draft', () => {
    const blank = { assessment: { plan: { advice: '', plans: [] }, rpe: { value: 0 } } };
    expect(hasPersistedAgentChanges({ ...blank, version: 1, createdAt: 'same', updatedAt: 'same' })).toBe(false);
    expect(hasPersistedAgentChanges({ ...blank, version: 2 })).toBe(true);
  });
  it('preserves the saved API representation through load and serialization', () => {
    const saved = { clinicalDetails: { chiefComplaint: 'Pain' }, subjectiveAssessments: [],
      objectiveAssessments: [{ tests: [{ testName: 'ROM', value: 0, left: null, right: 17.5 }] }],
      patientAdvice: { adviceDetails: '' } };
    expect(buildReportPayload('firstAssessment', firstAssessmentToForm(saved))).toEqual({ firstAssessment: saved });
  });
  it('rejects multiple groups rather than silently discarding one', () => {
    expect(() => firstAssessmentToForm({ objectiveAssessments: [{tests:[]},{tests:[]}] })).toThrow();
  });
});
