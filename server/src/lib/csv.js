// Minimal CSV serializer/parser — RFC 4180 style quoting, Excel/Google Sheets
// compatible, no external dependency.

function escapeField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export function toCsv(rows, columns) {
    if (!rows.length && !columns) return '';
    const cols = columns || Object.keys(rows[0]);
    const lines = [cols.map(escapeField).join(',')];
    for (const row of rows) {
        lines.push(cols.map((c) => escapeField(row[c])).join(','));
    }
    return lines.join('\r\n') + '\r\n';
}

// Parses CSV text into an array of objects keyed by the header row.
export function parseCsv(text) {
    const rows = [];
    let field = '';
    let record = [];
    let inQuotes = false;
    const src = String(text || '').replace(/^﻿/, ''); // strip BOM

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQuotes) {
            if (ch === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            record.push(field);
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            record.push(field);
            field = '';
            if (record.length > 1 || record[0] !== '') rows.push(record);
            record = [];
        } else {
            field += ch;
        }
    }
    if (field !== '' || record.length > 0) {
        record.push(field);
        if (record.length > 1 || record[0] !== '') rows.push(record);
    }

    if (rows.length < 1) return { header: [], records: [] };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const records = rows.slice(1).map((r) => {
        const obj = {};
        header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
        return obj;
    });
    return { header, records };
}
