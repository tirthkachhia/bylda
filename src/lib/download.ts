/** Quote cells and neutralize spreadsheet formulas in user-supplied exports. */
export function csvText(rows: unknown[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          let s = value === null || value === undefined ? "" : String(value);
          if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
          return `"${s.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
