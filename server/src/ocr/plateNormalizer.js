// Corrects common OCR character confusions using the known structure of an
// Indian plate: 2 letters (state) + 2 digits (RTO) + 1-2 letters (series) + 4 digits.
const DIGIT_FIX = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const LETTER_FIX = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 6: 'G', 2: 'Z' };

function fixChar(ch, wantDigit) {
    if (wantDigit) return /[0-9]/.test(ch) ? ch : (DIGIT_FIX[ch] || ch);
    return /[A-Z]/.test(ch) ? ch : (LETTER_FIX[ch] || ch);
}

const FORMATS = [
    { length: 10, pattern: 'LLDDLLDDDD' }, // e.g. KA05AIB2026 -> 2-letter series
    { length: 9, pattern: 'LLDDLDDDD' },   // e.g. KA05A2026 -> 1-letter series
];

export function normalizePlate(rawText) {
    const cleaned = (rawText || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fmt = FORMATS.find((f) => f.length === cleaned.length);
    if (!fmt) return cleaned;

    let out = '';
    for (let i = 0; i < fmt.length; i++) {
        out += fixChar(cleaned[i], fmt.pattern[i] === 'D');
    }
    return out;
}

export function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[m][n];
}

// Finds the closest existing plates to a normalized OCR read, for when the
// exact string isn't in the registry (OCR noise, partial occlusion, etc).
export function findClosestPlates(normalized, allPlateNumbers, maxDistance = 2, limit = 3) {
    const candidates = [];
    for (const plate of allPlateNumbers) {
        if (Math.abs(plate.length - normalized.length) > maxDistance) continue;
        const distance = levenshtein(normalized, plate);
        if (distance <= maxDistance && distance > 0) candidates.push({ plate, distance });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.slice(0, limit);
}
