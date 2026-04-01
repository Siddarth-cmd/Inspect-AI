// Utility: Save and retrieve inspection records from localStorage.
// This is the primary data store for the frontend dashboard and history.

const STORAGE_KEY = 'inspectai_records';

export function saveInspectionLocally(filename, results) {
  const record = {
    id: Date.now().toString(),
    filename: filename,
    quality_score: results.quality_score,
    defects: results.defects || [],
    date: new Date().toISOString(),
  };
  const existing = getLocalInspections();
  const updated = [record, ...existing];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return record;
}

export function getLocalInspections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocalInspections() {
  localStorage.removeItem(STORAGE_KEY);
}
