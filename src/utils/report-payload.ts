/** One serializer for manual and automatic report saves. */
const OMIT = new Set(['record', '__typename', '_id', 'createdAt', 'updatedAt']);

function clean(value: any, key = ''): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(item => clean(item));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([name, item]) => !OMIT.has(name) && item !== undefined)
      .map(([name, item]) => [name, clean(item, name)]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid numeric value');
  return key === 'load' && typeof value === 'number' ? String(value) : value;
}

function measurement(value: any) {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'boolean') throw new Error('Invalid measurement');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Invalid measurement');
  return number;
}

function tests(rows: any) {
  if (!Array.isArray(rows)) throw new Error('Invalid assessment tests');
  return rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('Invalid assessment test');
    }
    const result: Record<string, any> = {};
    if ('testName' in row || 'name' in row) result.testName = row.testName ?? row.name ?? '';
    if ('unitName' in row || 'unit' in row) result.unitName = row.unitName ?? row.unit ?? '';
    if ('comments' in row || 'details' in row) result.comments = row.comments ?? row.details ?? '';
    for (const name of ['value', 'left', 'right']) {
      if (Object.prototype.hasOwnProperty.call(row, name)) {
        result[name] = measurement(row[name]);
      }
    }
    return result;
  });
}

function firstAssessmentPayload(data: any) {
  const objectiveSource = Object.prototype.hasOwnProperty.call(data, 'objectiveAssessment')
    ? data.objectiveAssessment
    : data.objectiveAssessments?.[0];
  const result: Record<string, any> = {};

  if (data.clinicalDetails && typeof data.clinicalDetails === 'object') {
    result.clinicalDetails = Object.fromEntries(
      ['clinicalHistory', 'chiefComplaint', 'duration']
        .filter(name => Object.prototype.hasOwnProperty.call(data.clinicalDetails, name))
        .map(name => [name, data.clinicalDetails[name]])
    );
  }
  if (Object.prototype.hasOwnProperty.call(data, 'subjectiveAssessments')) {
    result.subjectiveAssessments = (Array.isArray(data.subjectiveAssessments)
      ? data.subjectiveAssessments
      : []).map((row: any) => ({
        ...(row && ('testName' in row || 'name' in row)
          ? { testName: row.testName ?? row.name ?? '' } : {}),
        ...(row && ('conclusion' in row || 'description' in row || 'details' in row)
          ? { conclusion: row.conclusion ?? row.description ?? row.details ?? '' } : {}),
      }));
  }
  if (objectiveSource !== undefined) {
    result.objectiveAssessments = objectiveSource === null
      ? null
      : [{ tests: tests(objectiveSource?.tests || []) }];
  }
  if (Object.prototype.hasOwnProperty.call(data, 'subjectiveGoals')) {
    result.subjectiveGoals = (Array.isArray(data.subjectiveGoals)
      ? data.subjectiveGoals
      : []).map((row: any) => ({
        goalDetails: row?.goalDetails ?? row?.goal ?? '',
        targetDate: row?.targetDate ?? '',
      }));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'objectiveGoals')) {
    result.objectiveGoals = (Array.isArray(data.objectiveGoals)
      ? data.objectiveGoals
      : []).map((row: any) => ({
        goalName: row?.goalName ?? '',
        goalCategory: row?.goalCategory ?? '',
        unitName: row?.unitName ?? '',
        value: row?.value ?? '',
        targetDate: row?.targetDate ?? '',
      }));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'recommendation')) {
    result.recommendation = (Array.isArray(data.recommendation)
      ? data.recommendation
      : []).map((row: any) => ({
        sessionType: row?.sessionType ?? '',
        sessionFrequency: row?.sessionFrequency ?? row?.frequency ?? '',
      }));
  }
  if (Object.prototype.hasOwnProperty.call(data, 'patientAdvice')) {
    result.patientAdvice = {
      adviceDetails: data.patientAdvice?.adviceDetails ?? data.patientAdvice?.details ?? '',
    };
  }
  return result;
}

export function buildReportPayload(formKey: string, form: any): any {
  if (!['assessment', 'firstAssessment', 'snc', 'physio'].includes(formKey)) {
    throw new Error('Unsupported form type');
  }
  if (!form || typeof form !== 'object' || Array.isArray(form)) throw new Error('Invalid form');
  const data = clean(form);
  if (data.objectiveAssessment?.tests) data.objectiveAssessment.tests = tests(data.objectiveAssessment.tests);
  if (data.tests) data.tests = tests(data.tests);
  if (data.rpe && Object.prototype.hasOwnProperty.call(data.rpe, 'value')) {
    data.rpe.value = measurement(data.rpe.value);
    if (data.rpe.value !== null && (data.rpe.value < 0 || data.rpe.value > 10)) throw new Error('RPE must be between 0 and 10');
  }
  if (formKey === 'firstAssessment') return { firstAssessment: firstAssessmentPayload(data) };
  return { [formKey]: data };
}

// One ordered queue per appointment; failures do not block subsequent saves.
const saves = new Map<string, Promise<unknown>>();
export async function queueReportSave<T>(appointmentId: string, save: () => Promise<T>): Promise<T> {
  const previous = saves.get(appointmentId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(save);
  saves.set(appointmentId, next);
  try { return await next; }
  finally { if (saves.get(appointmentId) === next) saves.delete(appointmentId); }
}
