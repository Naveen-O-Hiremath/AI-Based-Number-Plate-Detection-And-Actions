import { createWorker } from 'tesseract.js';

// Lazily-initialized, reused Tesseract worker — avoids paying the ~1-2s model
// load cost on every scan. This is the "AI locates the plate / OCR reads the
// number" step of the pipeline, running centrally on the server rather than
// in the browser, matching the architecture in docs/ARCHITECTURE.md.
let workerPromise = null;

function getWorker() {
    if (!workerPromise) {
        workerPromise = (async () => {
            const worker = await createWorker('eng');
            // Plates only contain A-Z and 0-9 — constraining the character set
            // sharply reduces the noise OCR produces from background scenery.
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                preserve_interword_spaces: '1',
            });
            return worker;
        })();
    }
    return workerPromise;
}

// image: Buffer, data: URL string, or base64 string — anything tesseract.js accepts.
export async function recognizePlateText(image) {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return { rawText: data.text.trim(), confidence: data.confidence };
}

// Recognize with a specific page-segmentation mode. PSM 6 treats the image as
// one uniform text block (good for a cropped plate, incl. two-line plates);
// PSM 11 finds sparse text anywhere (good for frames with several plates).
export async function recognizeWithMode(image, psm) {
    const worker = await getWorker();
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    try {
        const { data } = await worker.recognize(image);
        return { rawText: data.text.trim(), confidence: data.confidence };
    } finally {
        await worker.setParameters({ tessedit_pageseg_mode: '3' });
    }
}

export async function shutdownOcr() {
    if (workerPromise) {
        const worker = await workerPromise;
        await worker.terminate();
        workerPromise = null;
    }
}
