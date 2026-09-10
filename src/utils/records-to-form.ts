/**
 * Maps a clinician `Report.records` object (the real source-of-truth data the
 * clinician entered) into the shapes the form renderer consumes.
 *
 * Two targets, chosen by formKey / visitType:
 *   - firstAssessment (FIRST_VISIT): clinicalDetails, subjectiveAssessments,
 *     objectiveAssessment.tests, recommendation, patientAdvice, goals.
 *   - assessment (FOLLOW_UP): plan, subjectiveAssessment, objectiveAssessment,
 *     rpe.
 *
 * These shapes mirror src/schemas/form-schemas.ts so the renderer's
 * merge-with-defaults step lines up field-for-field.
 */

type AnyRecord = Record<string, any> | null | undefined;

const str = (v: any): string => (v === null || v === undefined ? '' : String(v));
const num = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Map objectiveAssessment tests from records into the schema test shape.
 * The assessment schema uses numeric value/left/right; the firstAssessment
 * schema uses strings. `numeric` selects which.
 */
function mapTests(tests: any, numeric: boolean): any[] {
  if (!Array.isArray(tests)) return [];
  const val = (v: any) => (numeric ? num(v) : str(v));
  return tests.map((t) => ({
    testName: str(t?.testName),
    unitName: str(t?.unitName),
    value: val(t?.value),
    left: val(t?.left),
    right: val(t?.right),
    comments: str(t?.comments),
  }));
}

/**
 * Records -> `assessment` form (FOLLOW_UP).
 * Shape must match formSchemas.assessment.
 */
export function mapRecordsToAssessment(records: AnyRecord): any {
  const rec = records || {};

  const planRec = rec.plan || {};
  const plans = Array.isArray(planRec.plans)
    ? planRec.plans.map((p: any) => ({
        exercise: str(p?.exercise),
        comments: str(p?.comments),
        set: Array.isArray(p?.set)
          ? p.set.map((s: any) => ({
              repetitions: num(s?.repetitions),
              load: str(s?.load),
              unit: str(s?.unit),
            }))
          : [{ repetitions: 0, load: '', unit: '' }],
        duration: {
          value: num(p?.duration?.value),
          unit: str(p?.duration?.unit),
        },
      }))
    : [];

  return {
    plan: {
      advice: str(planRec.advice),
      plans:
        plans.length > 0
          ? plans
          : [
              {
                exercise: '',
                comments: '',
                set: [{ repetitions: 0, load: '', unit: '' }],
                duration: { value: 0, unit: '' },
              },
            ],
    },
    subjectiveAssessment: {
      assessment: str(rec.subjectiveAssessment?.assessment),
    },
    objectiveAssessment: {
      tests: mapTests(rec.objectiveAssessment?.tests, true),
    },
    rpe: {
      value: num(rec.rpe?.value),
    },
  };
}

/**
 * Records -> `firstAssessment` form (FIRST_VISIT).
 * Shape must match formSchemas.firstAssessment.
 *
 * Notes on the mapping:
 *   - records.clinicalDetails.chiefComplaints -> clinicalDetails.chiefComplaint
 *   - records.clinicalDetails.clientHistory   -> clinicalDetails.clinicalHistory
 *   - records.document[] (free-text investigations) has no structured field in
 *     the firstAssessment schema; its details are appended into patientAdvice
 *     as reference text so the clinician still sees them. subjectiveAssessment
 *     text also feeds patientAdvice (that's where the "Plan=..." text lives).
 *   - records.recommendations[] -> recommendation[] (sessionType/sessionFrequency)
 */
/**
 * Split a clientHistory string into { history, duration }.
 *
 * The DB stores duration embedded inside clientHistory after a "Duration:"
 * marker (ClinicalRecord has no separate duration field), e.g.
 *   "no\n\nDuration: right knee since 2022 Nov , left knee since few weeks"
 * -> history: "no", duration: "right knee since 2022 Nov , left knee since few weeks".
 * If no marker is present, the whole string is treated as history and duration
 * is empty.
 */
function splitClientHistory(clientHistory: any): {
  history: string;
  duration: string;
} {
  const full = str(clientHistory);
  // Case-insensitive match on a "Duration:" label anywhere in the string.
  const match = full.match(/^([\s\S]*?)\bduration\s*:\s*([\s\S]*)$/i);
  if (match) {
    return {
      history: match[1].trim(),
      duration: match[2].trim(),
    };
  }
  return { history: full.trim(), duration: '' };
}

export function mapRecordsToFirstAssessment(records: AnyRecord): any {
  const rec = records || {};

  const cd = rec.clinicalDetails || {};
  const { history: clinicalHistory, duration } = splitClientHistory(
    cd.clientHistory
  );

  const tests = mapTests(rec.objectiveAssessment?.tests, false);

  const recommendations = Array.isArray(rec.recommendations)
    ? rec.recommendations.map((r: any) => ({
        sessionType: str(r?.sessionType),
        sessionFrequency: str(r?.frequency),
      }))
    : [];

  // Build advice text from subjective assessment + any document investigation
  // notes so nothing is silently dropped from the source records.
  const adviceParts: string[] = [];
  if (rec.subjectiveAssessment?.assessment) {
    adviceParts.push(str(rec.subjectiveAssessment.assessment));
  }
  if (Array.isArray(rec.document)) {
    const docNotes = rec.document
      .map((d: any) => str(d?.details).trim())
      .filter((d: string) => d.length > 0);
    if (docNotes.length > 0) {
      adviceParts.push('Investigations:\n' + docNotes.join('\n'));
    }
  }

  return {
    clinicalDetails: {
      clinicalHistory,
      chiefComplaint: str(cd.chiefComplaints),
      // Prefer an explicit records duration if the API ever provides one;
      // otherwise use the duration parsed out of clientHistory.
      duration: str(cd.duration) || duration,
    },
    subjectiveAssessments:
      rec.subjectiveAssessment?.assessment
        ? [{ testName: '', conclusion: str(rec.subjectiveAssessment.assessment) }]
        : [{ testName: '', conclusion: '' }],
    objectiveAssessment: {
      tests:
        tests.length > 0
          ? tests
          : [
              {
                testName: '',
                unitName: '',
                value: '',
                left: '',
                right: '',
                comments: '',
              },
            ],
    },
    subjectiveGoals: [{ goalDetails: '', targetDate: '' }],
    objectiveGoals: [
      {
        goalName: '',
        goalCategory: '',
        unitName: '',
        value: '',
        targetDate: '',
      },
    ],
    recommendation:
      recommendations.length > 0
        ? recommendations
        : [{ sessionType: '', sessionFrequency: '' }],
    patientAdvice: {
      adviceDetails: adviceParts.join('\n\n'),
    },
  };
}

/**
 * Dispatch by formKey. Unknown keys fall back to assessment mapping.
 */
export function mapRecordsToForm(formKey: string, records: AnyRecord): any {
  if (formKey === 'firstAssessment') {
    return mapRecordsToFirstAssessment(records);
  }
  return mapRecordsToAssessment(records);
}
