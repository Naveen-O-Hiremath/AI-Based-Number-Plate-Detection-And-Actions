import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER = 'anpr.serverUrl';
const KEY_NODE = 'anpr.nodeId';

export async function loadConfig() {
    const [serverUrl, nodeId] = await Promise.all([
        AsyncStorage.getItem(KEY_SERVER),
        AsyncStorage.getItem(KEY_NODE),
    ]);
    return {
        serverUrl: serverUrl || '',
        nodeId: nodeId || `MOBILE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    };
}

export async function saveConfig({ serverUrl, nodeId }) {
    await AsyncStorage.multiSet([[KEY_SERVER, serverUrl], [KEY_NODE, nodeId]]);
}

/** Strips a trailing slash and prepends http:// when the user omits a scheme. */
export function normalizeServerUrl(input) {
    let url = String(input || '').trim().replace(/\/+$/, '');
    if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
    return url;
}

export async function pingServer(serverUrl) {
    const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/health`, { method: 'GET' });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    return res.json();
}

/**
 * Sends a captured frame (or a manually typed plate) to the backend.
 * The backend runs Claude Vision / Tesseract, matches the registry, applies
 * policy, and returns the full detection result.
 */
export async function sendDetection({ serverUrl, nodeId, base64Image, plateNumber }) {
    const body = { camera_node_id: nodeId, node_label: `Mobile ${nodeId}` };
    if (plateNumber) body.plate_number = plateNumber;
    else body.image = `data:image/jpeg;base64,${base64Image}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
        const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
    } finally {
        clearTimeout(timeout);
    }
}

export const STATUS_COLORS = {
    WANTED_CRIMINAL: { bg: '#7f1d1d', border: '#ef4444', text: '#fecaca', label: 'WANTED — CRIMINAL' },
    SURVEILLANCE: { bg: '#78350f', border: '#f59e0b', text: '#fde68a', label: 'UNDER SURVEILLANCE' },
    NORMAL: { bg: '#14532d', border: '#22c55e', text: '#bbf7d0', label: 'NORMAL' },
    UNREGISTERED: { bg: '#1e293b', border: '#64748b', text: '#cbd5e1', label: 'NOT IN REGISTRY' },
    NO_PLATE: { bg: '#1e293b', border: '#475569', text: '#94a3b8', label: 'NO PLATE DETECTED' },
};
