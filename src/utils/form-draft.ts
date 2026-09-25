const key = (appointmentId: string, formKey: string) =>
  `clinician-agent-draft:${appointmentId}:${formKey}`;

export function saveFormDraft(appointmentId: string, formKey: string, data: any) {
  if (!appointmentId || !formKey) return;
  localStorage.setItem(key(appointmentId, formKey), JSON.stringify({ data, savedAt: Date.now() }));
}

export function loadFormDraft(appointmentId: string, formKey: string): any | null {
  if (!appointmentId || !formKey) return null;
  try {
    const raw = localStorage.getItem(key(appointmentId, formKey));
    return raw ? JSON.parse(raw)?.data ?? null : null;
  } catch {
    localStorage.removeItem(key(appointmentId, formKey));
    return null;
  }
}

export function clearFormDraft(appointmentId: string, formKey: string) {
  if (appointmentId && formKey) localStorage.removeItem(key(appointmentId, formKey));
}
