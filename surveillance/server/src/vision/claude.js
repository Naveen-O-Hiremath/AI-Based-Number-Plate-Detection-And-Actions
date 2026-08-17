import Anthropic from '@anthropic-ai/sdk';

// Claude Vision is the primary plate reader. It handles the hard cases a
// classical OCR engine fails on: angled shots, glare, embossed/hologram
// characters, and the hand-lettered plates used on scale-model test cars.
const MODEL = 'claude-opus-5';

let client = null;
export function claudeAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}
function getClient() {
    if (!client) client = new Anthropic();
    return client;
}

const PLATE_SCHEMA = {
    type: 'object',
    properties: {
        plate_number: {
            type: 'string',
            description:
                'The registration number with no spaces, dashes, or punctuation, e.g. KL07B1234. Empty string if no plate is legible.',
        },
        confidence: {
            type: 'number',
            description: 'Confidence between 0 and 1 that plate_number is correct.',
        },
    },
    required: ['plate_number', 'confidence'],
    additionalProperties: false,
};

const SYSTEM = `You read vehicle number plates from photographs for an automatic number plate recognition system.

Return the registration number exactly as printed, uppercase, with all spaces, dashes and punctuation removed.
Indian plates follow the pattern: two-letter state code, one or two RTO digits, one to three series letters, then four digits (e.g. KL07B1234, KA01AB1111).

Rules:
- Transcribe only what is actually legible. Never guess a plausible-looking plate.
- If the image contains no readable number plate, return an empty plate_number and a confidence of 0.
- If several plates are visible, return the one that is largest and most clearly in focus.
- Small, hand-lettered, or hand-written plates on model/toy vehicles are valid — read them the same way.
- Set confidence to reflect how certain you are: below 0.5 when characters are ambiguous.`;

function mediaTypeOf(dataUrl) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,/.exec(dataUrl || '');
    return m ? m[1] : 'image/jpeg';
}

/**
 * @param {string} imageDataUrl base64 data URL of the captured frame
 * @returns {Promise<{plate_number: string, confidence: number, source: string}>}
 */
export async function readPlateWithClaude(imageDataUrl) {
    const base64 = String(imageDataUrl).replace(/^data:image\/\w+;base64,/, '');
    const response = await getClient().beta.messages.create({
        model: MODEL,
        max_tokens: 2048,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEM,
        output_config: {
            effort: 'low',
            format: { type: 'json_schema', schema: PLATE_SCHEMA },
        },
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: mediaTypeOf(imageDataUrl), data: base64 },
                    },
                    { type: 'text', text: 'Read the number plate in this image.' },
                ],
            },
        ],
    });

    // Safety classifiers can decline a request; check before reading content.
    if (response.stop_reason === 'refusal') {
        const err = new Error(
            `Claude declined this image (${response.stop_details?.category ?? 'unspecified'})`
        );
        err.code = 'REFUSAL';
        throw err;
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Claude returned no text content');

    const parsed = JSON.parse(textBlock.text);
    return {
        plate_number: String(parsed.plate_number || '').toUpperCase(),
        confidence: Number(parsed.confidence) || 0,
        source: 'claude-vision',
    };
}
