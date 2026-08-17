const BASE = '/api';

function getToken() {
    return localStorage.getItem('anpr_token');
}

export function setToken(token) {
    if (token) localStorage.setItem('anpr_token', token);
    else localStorage.removeItem('anpr_token');
}

async function request(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
        const hadToken = !!token;
        setToken(null);
        // Only force a hard redirect when a real session expired mid-use.
        // With no token yet (first visit / already logged out), this 401 is
        // just the normal "not authenticated" check — let the caller handle
        // it quietly instead of reload-looping on the login page itself.
        if (hadToken && window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        throw new Error('Session expired');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

export const api = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
};

// Fetches a file endpoint with auth and triggers a browser download.
export async function downloadFile(path) {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Download failed (${res.status})`);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match ? match[1] : 'export.csv';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
