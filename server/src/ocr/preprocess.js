import { Jimp, JimpMime } from 'jimp';

// Real plates are hard for OCR: embossed characters, hologram texture inside
// the glyphs ("INDIA INDIA…"), glare, and both dark-on-light and light-on-dark
// color schemes. One lightly-processed image is not enough — we produce several
// preprocessing variants and let the pipeline try them in order.

// Otsu's method: picks the binarization threshold that best separates the
// two intensity classes (characters vs background) for THIS image, instead of
// a fixed cutoff that fails under different lighting.
function otsuThreshold(img) {
    const { data } = img.bitmap;
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    const total = data.length / 4;

    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];

    let sumB = 0;
    let wB = 0;
    let maxVar = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;
        const wF = total - wB;
        if (wF === 0) break;
        sumB += t * hist[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);
        if (between > maxVar) {
            maxVar = between;
            threshold = t;
        }
    }
    return threshold;
}

function applyThreshold(img, cut) {
    const { data } = img.bitmap;
    for (let i = 0; i < data.length; i += 4) {
        const v = data[i] >= cut ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
    }
    return img;
}

export async function buildVariants(buffer) {
    const base = await Jimp.read(buffer);

    // Tesseract wants characters ≥ ~30px tall; upscale small crops.
    if (base.bitmap.width < 1100) {
        base.resize({ w: 1100 });
    }
    base.greyscale();
    try { base.normalize(); } catch { /* flat image; normalize is optional */ }

    const variants = [];

    // 1. Binarized — collapses hologram texture inside glyphs into solid
    //    strokes; usually the strongest variant for plates.
    const bin = applyThreshold(base.clone(), otsuThreshold(base));
    variants.push({ name: 'binary', buffer: await bin.getBuffer(JimpMime.png) });

    // 2. Plain contrast-boosted grayscale — best when binarization eats thin
    //    strokes or the plate is unevenly lit.
    const gray = base.clone().contrast(0.3);
    variants.push({ name: 'gray', buffer: await gray.getBuffer(JimpMime.png) });

    // 3. Inverted binary — for light-text-on-dark plates (older bike plates).
    const inv = bin.clone().invert();
    variants.push({ name: 'binary-inverted', buffer: await inv.getBuffer(JimpMime.png) });

    return variants;
}
