export type CsvCell = string | number | null | undefined;

const CSV_SEPARATOR = ';';

function normalizeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function escapeCsvCell(value: CsvCell, separator = CSV_SEPARATOR): string {
  const normalizedValue = normalizeCsvCell(value);
  const shouldEscape =
    normalizedValue.includes(separator) ||
    normalizedValue.includes(',') ||
    normalizedValue.includes('"') ||
    normalizedValue.includes('\n') ||
    normalizedValue.includes('\r');

  if (!shouldEscape) return normalizedValue;

  return `"${normalizedValue.replace(/"/g, '""')}"`;
}

export function buildCsv(rows: CsvCell[][], separator = CSV_SEPARATOR): string {
  return rows.map((row) => row.map((cell) => escapeCsvCell(cell, separator)).join(separator)).join('\n');
}
