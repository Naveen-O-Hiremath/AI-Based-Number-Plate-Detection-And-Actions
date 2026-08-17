// Indian plate structure: 2 letters (state) + 1-2 digits (RTO) + 1-3 letters (series) + 4 digits.
// OCR confuses characters by shape; we correct per-position using that structure.
const TO_DIGIT = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7', A: '4' };
const TO_LETTER = { 0: 'O', 1: 'I', 2: 'Z', 5: 'S', 6: 'G', 8: 'B', 4: 'A' };

const SHAPE = /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}$/;
const STRICT = /[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{3,4}/g;
const TOLERANT = /[A-Z0-9]{2}[0-9OIZSBGTA]{1,2}[A-Z0158Z6]{1,3}[0-9OIZSBGTA]{3,4}/g;

const STATE_CODES = new Set([
    'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HP', 'HR', 'JH', 'JK',
    'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR', 'PB', 'PY', 'RJ', 'SK',
    'TN', 'TR', 'TS', 'UK', 'UP', 'UA', 'WB',
]);

export function cleanRaw(text) {
    return (text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Applies positional character correction to a candidate of known plate shape.
function correct(candidate) {
    const m = candidate.match(/^(..)(.{1,2}?)([A-Z0-9]{1,3}?)(.{3,4})$/);
    if (!m) return candidate;
    const [, state, rto, series, number] = m;
    const asLetter = (c) => (/[A-Z]/.test(c) ? c : TO_LETTER[c] || c);
    const asDigit = (c) => (/[0-9]/.test(c) ? c : TO_DIGIT[c] || c);
    return (
        [...state].map(asLetter).join('') +
        [...rto].map(asDigit).join('') +
        [...series].map(asLetter).join('') +
        [...number].map(asDigit).join('')
    );
}

function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

/**
 * Pulls plate-shaped substrings out of arbitrary OCR text. Returns [] when the
 * text contains nothing plate-like — the caller must report "no plate found"
 * rather than fabricating one out of background noise.
 */
export function extractPlates(rawText) {
    const cleaned = cleanRaw(rawText);
    if (!cleaned) return [];

    const windows = [];
    const consider = (match) => {
        const fixed = correct(match[0]);
        if (SHAPE.test(fixed) && STATE_CODES.has(fixed.slice(0, 2))) {
            windows.push({ plate: fixed, start: match.index, len: match[0].length });
        }
    };
    for (const m of cleaned.matchAll(STRICT)) consider(m);
    for (const m of cleaned.matchAll(TOLERANT)) consider(m);

    // Longest window wins on overlap — it explains more of the OCR text.
    windows.sort((a, b) => b.len - a.len || a.start - b.start);
    const kept = [];
    for (const w of windows) {
        if (!kept.some((k) => w.start < k.start + k.len && k.start < w.start + w.len)) kept.push(w);
    }
    kept.sort((a, b) => a.start - b.start);
    return [...new Set(kept.map((w) => w.plate))];
}

export function normalizePlate(text) {
    const cleaned = cleanRaw(text);
    if (SHAPE.test(cleaned)) return cleaned;
    const fixed = correct(cleaned);
    if (SHAPE.test(fixed)) return fixed;
    return extractPlates(cleaned)[0] || cleaned;
}

export function findNearest(plate, candidates, maxDistance = 2, limit = 3) {
    return candidates
        .filter((c) => Math.abs(c.length - plate.length) <= maxDistance)
        .map((c) => ({ plate: c, distance: editDistance(plate, c) }))
        .filter((c) => c.distance > 0 && c.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}
