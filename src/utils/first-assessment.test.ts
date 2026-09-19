import { describe, expect, it } from 'vitest';
import { firstAssessmentToForm } from './first-assessment';
import { buildReportPayload } from './report-payload';

describe('first assessment round trip', () => {
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
