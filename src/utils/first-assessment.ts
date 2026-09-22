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

export function assessmentToForm(saved: any) {
  if (!saved) return null;
  const objective = Array.isArray(saved.objectiveAssessment)
    ? saved.objectiveAssessment[0] ?? { tests: [] }
    : saved.objectiveAssessment ?? { tests: [] };
  return {
    plan: {
      advice: saved.plan?.advice ?? '',
      plans: Array.isArray(saved.plan?.plans) ? saved.plan.plans.map((plan: any) => ({
        ...plan, set: Array.isArray(plan?.set) ? plan.set : plan?.set ? [plan.set] : [],
      })) : [],
    },
    subjectiveAssessment: { assessment: saved.subjectiveAssessment?.assessment ?? '' },
    objectiveAssessment: { tests: Array.isArray(objective?.tests) ? objective.tests : [] },
    rpe: { value: saved.rpe?.value ?? 0 },
  };
}

const meaningful = (value: any): boolean => {
  if (value === null || value === undefined || value === '' || value === 0 || value === false) return false;
  if (Array.isArray(value)) return value.some(meaningful);
  if (typeof value === 'object') return Object.entries(value)
    .filter(([key]) => key !== 'record' && key !== '__typename')
    .some(([, item]) => meaningful(item));
  return true;
};

/** Prefer an edited Agent draft; use Report.records only for a new blank draft. */
export function hasPersistedAgentChanges(report: any): boolean {
  if (!report?.assessment) return false;
  if (Number(report.version) > 1) return true;
  if (report.createdAt && report.updatedAt && String(report.createdAt) !== String(report.updatedAt)) return true;
  return meaningful(report.assessment);
}
