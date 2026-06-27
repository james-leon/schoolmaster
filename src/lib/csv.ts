// CSV cell escaping with formula-injection guard.
// Prefix a single quote when a text cell starts with =, +, -, @, TAB, CR, or LF
// so spreadsheets treat the cell as text. Real numeric values (including
// negatives like -1500) keep their numeric form.
export function csvCell(v: unknown): string {
  if (v == null) return '""';
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  let s = String(v);
  // If the string is a valid finite number, leave it as numeric text
  // (avoids breaking negative-number columns).
  if (s !== "" && !Number.isNaN(Number(s)) && Number.isFinite(Number(s))) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}
