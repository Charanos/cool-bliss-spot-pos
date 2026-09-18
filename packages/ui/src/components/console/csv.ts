/**
 * CSV export honouring the current filters, with the filter state in the filename. N-12.
 * Money exports as a plain decimal with no grouping so a spreadsheet reads it as a number.
 */

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\r\n');
}

export function exportFilename(base: string, params: URLSearchParams, date: string): string {
  const parts = [base];
  for (const [key, value] of params) {
    if (!value || key === 'density' || key === 'sort') continue;
    parts.push(`${key}-${value}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'));
  }
  parts.push(date);
  return `${parts.join('_').replace(/-+/g, '-')}.csv`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
