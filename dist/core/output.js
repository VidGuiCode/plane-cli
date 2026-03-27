export function printInfo(message) {
    console.log(message);
}
export function printError(message) {
    console.error(`✗  ${message}`);
}
export function printJson(value) {
    console.log(JSON.stringify(value, null, 2));
}
export function printTable(rows, headers) {
    if (rows.length === 0 && !headers)
        return;
    const allRows = headers ? [headers, ...rows] : rows;
    const widths = allRows[0].map((_, i) => Math.max(...allRows.map((r) => (r[i] ?? "").length)));
    if (headers) {
        console.log(headers.map((h, i) => h.padEnd(widths[i])).join("   "));
        console.log(widths.map((w) => "─".repeat(w)).join("   "));
    }
    for (const row of rows) {
        console.log(row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("   "));
    }
}
//# sourceMappingURL=output.js.map