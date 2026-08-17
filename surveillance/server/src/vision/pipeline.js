import { claudeAvailable, readPlateWithClaude } from './claude.js';
import { readPlateWithTesseract } from './tesseract.js';
import { normalizePlate, extractPlates } from './normalize.js';

/**
 * Hybrid vision pipeline.
 *
 *   Claude Vision (primary, when ANTHROPIC_API_KEY is set)
 *        └── on failure / low confidence / no key → Tesseract (local fallback)
 *
 * Always returns a result object; never throws for an unreadable frame —
 * an empty `plate_number` is the honest answer for a frame with no plate.
 */
export async function extractPlate(imageDataUrl, { preferLocal = false } = {}) {
    const attempts = [];

    if (claudeAvailable() && !preferLocal) {
        try {
            const result = await readPlateWithClaude(imageDataUrl);
            const normalized = normalizePlate(result.plate_number);
            attempts.push({ engine: 'claude-vision', plate: normalized, confidence: result.confidence });

            if (normalized && result.confidence >= 0.4) {
                return {
                    plate_number: normalized,
                    confidence: result.confidence,
                    source: 'claude-vision',
                    attempts,
                };
            }
        } catch (err) {
            attempts.push({ engine: 'claude-vision', error: err.message });
            console.warn('[vision] Claude failed, falling back to Tesseract:', err.message);
        }
    }

    const local = await readPlateWithTesseract(imageDataUrl);
    const normalized = normalizePlate(local.plate_number);
    attempts.push({ engine: 'tesseract', plate: normalized, confidence: local.confidence });

    return {
        plate_number: normalized,
        confidence: local.confidence,
        source: local.source,
        raw_text: local.raw_text,
        other_plates: (local.other_plates || []).map(normalizePlate),
        attempts,
    };
}

export { extractPlates, normalizePlate };
