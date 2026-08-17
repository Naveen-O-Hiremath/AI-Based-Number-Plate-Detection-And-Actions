import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const EXPORTS = [
    ['vehicles', 'Vehicles & owners'],
    ['fines', 'Fines / infringements'],
    ['movements', 'Movement logs'],
    ['alerts', 'Alerts'],
    ['audit', 'Audit trail'],
];

const TYPE_COLOR = {
    ALERT_CRITICAL: 'text-red-400',
    SURVEILLANCE_HIT: 'text-amber-400',
    DETECTION: 'text-blue-400',
    DETECTION_UNMATCHED: 'text-slate-400',
    VEHICLE_ADDED: 'text-emerald-400',
    STATUS_CHANGED: 'text-purple-400',
    EXPORT: 'text-cyan-400',
};

export default function AuditLog() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [eventType, setEventType] = useState('');
    const [page, setPage] = useState(1);
    const limit = 50;

    useEffect(() => {
        const params = new URLSearchParams({ page, limit, ...(eventType && { event_type: eventType }) });
        api.get(`/audit?${params}`).then((r) => { setRows(r.data); setTotal(r.total); }).catch(() => {});
    }, [eventType, page]);

    const pages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="card">
                <div className="mb-3 text-sm font-semibold">Export data</div>
                <div className="flex flex-wrap gap-2">
                    {EXPORTS.map(([entity, label]) => (
                        <div key={entity} className="flex items-center gap-1 rounded-lg border border-line bg-ink-800 p-1.5">
                            <span className="px-2 text-xs text-slate-300">{label}</span>
                            <a className="btn-ghost text-[11px]" href={`/api/export/${entity}.csv`}>CSV</a>
                            <a className="btn-ghost text-[11px]" href={`/api/export/${entity}.json`}>JSON</a>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <select
                    className="input"
                    value={eventType}
                    onChange={(e) => { setEventType(e.target.value); setPage(1); }}
                >
                    <option value="">All event types</option>
                    {Object.keys(TYPE_COLOR).map((t) => <option key={t} value={t}>{t}</option>)}
                    <option value="SYSTEM">SYSTEM</option>
                    <option value="NODE_REGISTERED">NODE_REGISTERED</option>
                    <option value="ALERT_ACKNOWLEDGED">ALERT_ACKNOWLEDGED</option>
                </select>
                <span className="text-xs text-slate-500">{total.toLocaleString()} entries</span>
            </div>

            <div className="card overflow-x-auto p-0">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="th w-40">Event</th>
                            <th className="th">Description</th>
                            <th className="th w-44">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="hover:bg-ink-600/40">
                                <td className={`td mono text-xs font-semibold ${TYPE_COLOR[r.event_type] || 'text-slate-400'}`}>
                                    {r.event_type}
                                </td>
                                <td className="td text-slate-300">{r.description}</td>
                                <td className="td mono text-xs text-slate-500">{r.timestamp}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && <div className="py-12 text-center text-sm text-slate-500">No audit entries.</div>}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span>Page {page} of {pages}</span>
                <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
        </div>
    );
}
