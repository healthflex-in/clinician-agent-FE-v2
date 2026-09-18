/** Fields verified against the configured report API. */
export const FIRST_ASSESSMENT_FIELDS = `
  clinicalDetails { clinicalHistory chiefComplaint duration }
  subjectiveAssessments { testName conclusion }
  objectiveAssessments { tests { testName unitName value left right comments } }
  subjectiveGoals { goalDetails targetDate }
  objectiveGoals { goalName goalCategory unitName value targetDate }
  recommendation { sessionType sessionFrequency }
  patientAdvice { adviceDetails }
`;

export function firstAssessmentToForm(saved: any) {
  if (!saved) return null;
  const { objectiveAssessments, ...rest } = saved;
  if (Array.isArray(objectiveAssessments) && objectiveAssessments.length > 1) {
    throw new Error('Multiple objective assessment groups need a supported editor');
  }
  return {
    ...rest,
    objectiveAssessment: objectiveAssessments?.[0] ?? { tests: [] },
  };
}
