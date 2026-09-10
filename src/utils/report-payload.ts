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
    const result = { ...row };
    for (const name of ['value', 'left', 'right']) {
      if (Object.prototype.hasOwnProperty.call(result, name)) result[name] = measurement(result[name]);
    }
    return result;
  });
}

export function buildReportPayload(formKey: string, form: any) {
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
  if (formKey === 'firstAssessment' && Object.prototype.hasOwnProperty.call(data, 'objectiveAssessment')) {
    data.objectiveAssessments = data.objectiveAssessment === null ? null : [data.objectiveAssessment];
    delete data.objectiveAssessment;
  }
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
