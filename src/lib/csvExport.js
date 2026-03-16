/**
 * CSV export: build CSV string from rows and trigger download.
 * @param {Array<Record<string, unknown>>} rows - Array of objects
 * @param {Array<{ key: string, label: string }>} columns - Column definitions (key = row key, label = CSV header)
 * @returns {string} CSV content
 */
export function toCSV(rows, columns) {
  if (!Array.isArray(rows) || !Array.isArray(columns) || columns.length === 0) return '';
  const header = columns.map((c) => escapeCSV(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCSV(valueToCell(row[c.key]))).join(',')
  );
  return [header, ...lines].join('\n');
}

function escapeCSV(str) {
  const s = String(str ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function valueToCell(v) {
  if (v == null) return '';
  if (typeof v === 'object' && typeof v.toISOString === 'function') return v.toISOString();
  return v;
}

/**
 * Trigger browser download of a CSV file.
 * @param {string} filename - e.g. 'clients-export.csv'
 * @param {string} csvContent - Full CSV string
 */
export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.csv';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
