import { normalizePlate } from './plateNormalizer.js';

// An Indian plate is structurally: 2 letters (a real state code) + 1-2 digits
// (RTO) + 1-3 letters (series) + 3-4 digits. OCR of a camera frame produces
// noisy text; instead of gluing every character together (which fabricates a
// "plate" out of scenery), we search for a substring with genuine plate
// structure and reject everything else.

// Official Indian state/UT registration codes.
const STATE_CODES = new Set([
    'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN', 'GA', 'GJ',
    'HP', 'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP',
    'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TN', 'TR', 'TS', 'UK',
    'UP', 'WB',
]);

// Strict: exact character classes.
const STRICT_RE = /[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}/g;

// Tolerant: allows common OCR confusions in digit positions (O↔0, I↔1, Z↔2,
// S↔5, B↔8, G↔6) and in letter positions. Guarded further below.
const TOLERANT_RE = /[A-Z]{2}[0-9OIZSBG]{1,2}[A-Z0158]{1,3}[0-9OIZSBG]{3,4}/g;

const FINAL_SHAPE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/;

function hasValidStateCode(candidate) {
    return STATE_CODES.has(candidate.slice(0, 2));
}

function correctionCount(raw, normalized) {
    if (raw.length !== normalized.length) return 99;
    let count = 0;
    for (let i = 0; i < raw.length; i++) {
        if (raw[i] !== normalized[i]) count++;
    }
    return count;
}

export function extractPlateCandidates(rawText) {
    // Newlines/spaces become nothing, so multi-line and multi-plate text
    // concatenates; positions below index into this cleaned string.
    const cleaned = (rawText || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) return [];

    // Collect every valid window from BOTH passes with its position. Running
    // strict alone first is a trap: "KAS1AF3810" (5 misread as S) strict-matches
    // one char late as "AS1AF3810" — a fake but valid-looking Assam plate —
    // while the tolerant window starting at K corrects it to KA51AF3810.
    const windows = [];

    for (const match of cleaned.matchAll(STRICT_RE)) {
        const normalized = normalizePlate(match[0]);
        if (FINAL_SHAPE.test(normalized) && hasValidStateCode(normalized)) {
            windows.push({ normalized, start: match.index, len: match[0].length });
        }
    }
    for (const match of cleaned.matchAll(TOLERANT_RE)) {
        const normalized = normalizePlate(match[0]);
        if (
            FINAL_SHAPE.test(normalized) &&
            hasValidStateCode(normalized) &&
            correctionCount(match[0], normalized) <= 2
        ) {
            windows.push({ normalized, start: match.index, len: match[0].length });
        }
    }

    // Longest window wins where windows overlap (the longer one explains more
    // of the OCR text); distinct plates in a multi-plate frame don't overlap
    // and all survive.
    windows.sort((a, b) => b.len - a.len || a.start - b.start);
    const kept = [];
    for (const w of windows) {
        const overlaps = kept.some((k) => w.start < k.start + k.len && k.start < w.start + w.len);
        if (!overlaps) kept.push(w);
    }

    kept.sort((a, b) => a.start - b.start);
    return [...new Set(kept.map((w) => w.normalized))];
}

// Returns the best single candidate or null when the frame contains nothing
// plate-shaped — the caller should report "no plate detected", not fabricate one.
export function extractBestPlate(rawText) {
    const candidates = extractPlateCandidates(rawText);
    if (candidates.length === 0) return null;
    // Prefer the longest (full 10-char plates over partial reads).
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
}
