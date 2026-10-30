export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function csvRows(rows: unknown[][]) {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function pageNumber(value: string | null) {
  const n = Number(value ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 10000 ? n : 0;
}
