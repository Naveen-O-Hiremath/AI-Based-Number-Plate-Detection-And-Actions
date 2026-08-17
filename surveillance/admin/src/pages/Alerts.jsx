import { useEffect, useState } from 'react';
import { api, timeAgo } from '../lib/api.js';

export default function Alerts() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [openOnly, setOpenOnly] = useState(false);
    const [page, setPage] = useState(1);
    const limit = 25;

    function load() {
        const params = new URLSearchParams({ page, limit, ...(openOnly && { acknowledged: 'false' }) });
        api.get(`/alerts?${params}`).then((r) => { setRows(r.data); setTotal(r.total); }).catch(() => {});
    }
    useEffect(load, [openOnly, page]);

    async function acknowledge(id) {
        await api.patch(`/alerts/${id}/acknowledge`);
        load();
    }

    const pages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                        type="checkbox"
                        checked={openOnly}
                        onChange={(e) => { setOpenOnly(e.target.checked); setPage(1); }}
                    />
                    Unacknowledged only
                </label>
                <div className="ml-auto flex gap-2">
                    <a className="btn-ghost" href="/api/export/alerts.csv">Export CSV</a>
                    <a className="btn-ghost" href="/api/export/alerts.json">Export JSON</a>
                </div>
            </div>

            <div className="space-y-2">
                {rows.map((a) => (
                    <div
                        key={a.id}
                        className={`card flex items-start gap-4 ${a.acknowledged ? 'opacity-60' : 'border-l-4 border-l-red-500'}`}
                    >
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-400">
                            ⚠
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="mono font-bold">{a.plate_number}</span>
                                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">
                                    {a.severity}
                                </span>
                                {a.acknowledged === 1 && (
                                    <span className="rounded-full bg-slate-600/30 px-2 py-0.5 text-[10px] text-slate-400">
                                        ACKNOWLEDGED
                                    </span>
                                )}
                            </div>
                            <div className="mt-1 text-sm text-slate-300">{a.message}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                                {a.vehicle_model ? `${a.vehicle_model} · ` : ''}{a.owner_name || 'Unknown owner'}
                                {a.node_location ? ` · ${a.node_location}` : ''}
                            </div>
                            {a.status_reason && (
                                <div className="mt-0.5 text-xs text-amber-300/80">{a.status_reason}</div>
                            )}
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="text-[11px] text-slate-500">{timeAgo(a.created_at)}</div>
                            {!a.acknowledged && (
                                <button className="btn-ghost mt-2 text-xs" onClick={() => acknowledge(a.id)}>
                                    Acknowledge
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {rows.length === 0 && (
                    <div className="card py-12 text-center text-sm text-slate-500">No alerts to show.</div>
                )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span>Page {page} of {pages} · {total} alerts</span>
                <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
        </div>
    );
}
