import { createWorker } from 'tesseract.js';
import { Jimp, JimpMime } from 'jimp';
import { extractPlates } from './normalize.js';

// Local OCR fallback — used when no ANTHROPIC_API_KEY is configured, or when a
// Claude Vision call fails. Runs fully offline after the first model download.

let workerPromise = null;
async function getWorker() {
    if (!workerPromise) {
        workerPromise = (async () => {
            const worker = await createWorker('eng');
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                preserve_interword_spaces: '1',
            });
            return worker;
        })();
    }
    return workerPromise;
}

// Otsu's method picks the binarization threshold per image, so plates read
// correctly under different lighting instead of against a fixed cutoff.
function otsu(img) {
    const { data } = img.bitmap;
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    const total = data.length / 4;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, max = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (!wB) continue;
        const wF = total - wB;
        if (!wF) break;
        sumB += t * hist[t];
        const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
        if (between > max) { max = between; threshold = t; }
    }
    return threshold;
}

function threshold(img, cut) {
    const { data } = img.bitmap;
    for (let i = 0; i < data.length; i += 4) {
        const v = data[i] >= cut ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = v;
    }
    return img;
}

async function variants(buffer) {
    const base = await Jimp.read(buffer);
    if (base.bitmap.width < 1100) base.resize({ w: 1100 });
    base.greyscale();
    try { base.normalize(); } catch { /* flat image */ }

    const binary = threshold(base.clone(), otsu(base));
    return [
        { name: 'binary', buffer: await binary.getBuffer(JimpMime.png) },
        { name: 'gray', buffer: await base.clone().contrast(0.3).getBuffer(JimpMime.png) },
        { name: 'binary-inverted', buffer: await binary.clone().invert().getBuffer(JimpMime.png) },
    ];
}

/**
 * Multi-pass OCR: preprocessing variants x segmentation modes, stopping at the
 * first pass that yields a structurally valid plate.
 */
export async function readPlateWithTesseract(imageDataUrl) {
    const buffer = Buffer.from(
        String(imageDataUrl).replace(/^data:image\/\w+;base64,/, ''), 'base64'
    );
    const worker = await getWorker();
    const built = await variants(buffer);

    let bestText = '';
    let bestConfidence = 0;

    for (const psm of ['6', '11']) {
        for (const variant of built) {
            await worker.setParameters({ tessedit_pageseg_mode: psm });
            let result;
            try {
                result = await worker.recognize(variant.buffer);
            } catch {
                continue;
            }
            const text = result.data.text.trim();
            const confidence = result.data.confidence / 100;
            if (confidence > bestConfidence) { bestText = text; bestConfidence = confidence; }

            const plates = extractPlates(text);
            if (plates.length) {
                await worker.setParameters({ tessedit_pageseg_mode: '3' });
                return {
                    plate_number: plates[0],
                    confidence: Math.max(confidence, 0.5),
                    source: 'tesseract',
                    raw_text: text,
                    other_plates: plates.slice(1),
                };
            }
        }
    }

    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    return { plate_number: '', confidence: 0, source: 'tesseract', raw_text: bestText, other_plates: [] };
}

export async function shutdownTesseract() {
    if (workerPromise) {
        (await workerPromise).terminate();
        workerPromise = null;
    }
}
