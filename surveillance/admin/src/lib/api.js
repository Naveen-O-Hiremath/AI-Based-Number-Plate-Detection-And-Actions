async function request(path, options = {}) {
    const res = await fetch(`/api${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

export const api = {
    get: (p) => request(p),
    post: (p, body) => request(p, { method: 'POST', body }),
    patch: (p, body) => request(p, { method: 'PATCH', body }),
};

export const STATUS_STYLES = {
    WANTED_CRIMINAL: {
        label: 'WANTED',
        chip: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40',
        dot: 'bg-red-500',
        row: 'border-l-4 border-red-500',
    },
    SURVEILLANCE: {
        label: 'SURVEILLANCE',
        chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40',
        dot: 'bg-amber-500',
        row: 'border-l-4 border-amber-500',
    },
    NORMAL: {
        label: 'NORMAL',
        chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40',
        dot: 'bg-emerald-500',
        row: 'border-l-4 border-emerald-600/50',
    },
    UNREGISTERED: {
        label: 'UNREGISTERED',
        chip: 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/40',
        dot: 'bg-slate-500',
        row: 'border-l-4 border-slate-600',
    },
    NO_PLATE: {
        label: 'NO PLATE',
        chip: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-600/40',
        dot: 'bg-slate-600',
        row: 'border-l-4 border-slate-700',
    },
};

export const statusStyle = (s) => STATUS_STYLES[s] || STATUS_STYLES.UNREGISTERED;

export function timeAgo(iso) {
    if (!iso) return '—';
    const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
    if (secs < 60) return `${Math.floor(secs)}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
}

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
