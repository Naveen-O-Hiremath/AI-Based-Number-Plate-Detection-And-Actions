import { buildVariants } from './preprocess.js';
import { recognizeWithMode } from './worker.js';
import { extractPlateCandidates } from './plateExtractor.js';

// Multi-pass OCR: preprocessing variants × segmentation modes, tried in order
// of expected yield. Stops as soon as a pass produces structurally-valid plate
// candidates; otherwise returns everything it saw so the caller can fall back
// to fuzzy matching. Accuracy over speed, by design.
export async function scanImageForPlates(imageDataUrl) {
    const base64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const variants = await buildVariants(buffer);

    // (variant, psm) passes, most-likely-to-succeed first.
    const passes = [];
    for (const psm of [6, 11]) {
        for (const variant of variants) passes.push({ variant, psm });
    }

    const attempts = [];
    const candidateVotes = new Map();

    for (const { variant, psm } of passes) {
        let rawText = '';
        let confidence = 0;
        try {
            const result = await recognizeWithMode(variant.buffer, psm);
            rawText = result.rawText;
            confidence = result.confidence;
        } catch {
            continue;
        }
        const candidates = extractPlateCandidates(rawText);
        attempts.push({ variant: variant.name, psm, rawText, confidence, candidates });

        for (const c of candidates) {
            candidateVotes.set(c, (candidateVotes.get(c) || 0) + 1);
        }
        // A valid candidate from a pass is trustworthy — the structure +
        // state-code checks make accidental matches unlikely. Stop early.
        if (candidates.length > 0) break;
    }

    const ranked = [...candidateVotes.entries()]
        .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
        .map(([plate]) => plate);

    // Best raw text for display: the attempt that yielded candidates, else the
    // attempt with the highest confidence.
    const bestAttempt =
        attempts.find((a) => a.candidates.length > 0) ||
        attempts.sort((a, b) => b.confidence - a.confidence)[0] ||
        { rawText: '', confidence: 0 };

    return {
        plates: ranked,
        rawText: bestAttempt.rawText,
        confidence: bestAttempt.confidence,
        passesRun: attempts.length,
    };
}
