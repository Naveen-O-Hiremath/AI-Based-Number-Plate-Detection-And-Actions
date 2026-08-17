import { useEffect, useState } from 'react';
import { api, statusStyle, money } from '../lib/api.js';

const STATUSES = ['NORMAL', 'SURVEILLANCE', 'WANTED_CRIMINAL'];

function AddVehicleModal({ onClose, onAdded }) {
    const [form, setForm] = useState({
        plate_number: '', owner_name: '', vehicle_model: '', vehicle_color: '',
        status: 'NORMAL', status_reason: '',
    });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    async function submit(e) {
        e.preventDefault();
        setBusy(true); setError('');
        try {
            await api.post('/vehicles', form);
            onAdded();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-xl border border-line bg-ink-700 p-5"
            >
                <h2 className="mb-4 text-base font-semibold">Add vehicle to registry</h2>
                {error && (
                    <div className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">{error}</div>
                )}
                <div className="space-y-3">
                    <div>
                        <label className="mb-1 block text-xs text-slate-400">Plate number</label>
                        <input className="input mono w-full" required placeholder="KL07B1234"
                               value={form.plate_number} onChange={set('plate_number')} />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-slate-400">Owner name</label>
                        <input className="input w-full" required value={form.owner_name} onChange={set('owner_name')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs text-slate-400">Model</label>
                            <input className="input w-full" required placeholder="Maruti Swift"
                                   value={form.vehicle_model} onChange={set('vehicle_model')} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs text-slate-400">Colour</label>
                            <input className="input w-full" value={form.vehicle_color} onChange={set('vehicle_color')} />
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-slate-400">Status</label>
                        <select className="input w-full" value={form.status} onChange={set('status')}>
                            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    {form.status !== 'NORMAL' && (
                        <div>
                            <label className="mb-1 block text-xs text-slate-400">Reason</label>
                            <input className="input w-full" placeholder="Reported stolen…"
                                   value={form.status_reason} onChange={set('status_reason')} />
                        </div>
                    )}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add vehicle'}</button>
                </div>
            </form>
        </div>
    );
}

export default function Directory() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [showAdd, setShowAdd] = useState(false);
    const [detail, setDetail] = useState(null);

    function load() {
        const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(status && { status }) });
        api.get(`/vehicles?${params}`).then((r) => { setRows(r.data); setTotal(r.total); }).catch(() => {});
    }
    useEffect(() => {
        const t = setTimeout(load, 200);
        return () => clearTimeout(t);
    }, [search, status, page, limit]);

    async function changeStatus(plate, newStatus) {
        await api.patch(`/vehicles/${plate}/status`, { status: newStatus });
        load();
        if (detail?.vehicle?.plate_number === plate) openDetail(plate);
    }
    function openDetail(plate) {
        api.get(`/vehicles/${plate}`).then(setDetail).catch(() => {});
    }

    const pages = Math.max(1, Math.ceil(total / limit));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <input className="input w-72" placeholder="Search plate, owner or model…"
                       value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <option value="">All statuses</option>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="input" value={limit} onChange={(e) => { setLimit(+e.target.value); setPage(1); }}>
                    {[10, 25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
                <div className="ml-auto flex gap-2">
                    <a className="btn-ghost" href="/api/export/vehicles.csv">Export CSV</a>
                    <a className="btn-ghost" href="/api/export/vehicles.json">Export JSON</a>
                    <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add vehicle</button>
                </div>
            </div>

            <div className="card overflow-x-auto p-0">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="th">Plate</th>
                            <th className="th">Owner</th>
                            <th className="th">Model</th>
                            <th className="th">Registered</th>
                            <th className="th">Unpaid</th>
                            <th className="th">Sightings</th>
                            <th className="th">Status</th>
                            <th className="th"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((v) => {
                            const style = statusStyle(v.status);
                            return (
                                <tr key={v.id} className="hover:bg-ink-600/40">
                                    <td className="td mono font-semibold">{v.plate_number}</td>
                                    <td className="td">{v.owner_name}</td>
                                    <td className="td text-slate-400">{v.vehicle_model}</td>
                                    <td className="td text-slate-400">{v.registration_date}</td>
                                    <td className="td">{v.unpaid_fines > 0
                                        ? <span className="text-amber-300">{v.unpaid_fines}</span>
                                        : <span className="text-slate-600">0</span>}</td>
                                    <td className="td text-slate-400">{v.sightings}</td>
                                    <td className="td">
                                        <select
                                            value={v.status}
                                            onChange={(e) => changeStatus(v.plate_number, e.target.value)}
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.chip} bg-transparent`}
                                        >
                                            {STATUSES.map((s) => <option key={s} value={s} className="bg-ink-800">{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="td">
                                        <button className="btn-ghost text-xs" onClick={() => openDetail(v.plate_number)}>
                                            View
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {rows.length === 0 && <div className="py-12 text-center text-sm text-slate-500">No vehicles match.</div>}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
                <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
                <span>Page {page} of {pages} · {total.toLocaleString()} vehicles</span>
                <button className="btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>

            {showAdd && <AddVehicleModal onClose={() => setShowAdd(false)} onAdded={load} />}

            {detail && (
                <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={() => setDetail(null)}>
                    <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-ink-700 p-5"
                         onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="mono text-xl font-bold">{detail.vehicle.plate_number}</div>
                                <div className="text-sm text-slate-300">
                                    {detail.vehicle.owner_name} · {detail.vehicle.vehicle_model}
                                    {detail.vehicle.vehicle_color ? ` · ${detail.vehicle.vehicle_color}` : ''}
                                </div>
                                {detail.vehicle.owner_phone && (
                                    <div className="text-xs text-slate-500">{detail.vehicle.owner_phone}</div>
                                )}
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle(detail.vehicle.status).chip}`}>
                                {statusStyle(detail.vehicle.status).label}
                            </span>
                        </div>

                        <div className="mt-4 text-sm font-semibold">Fines</div>
                        {detail.fines.length === 0
                            ? <div className="py-2 text-xs text-slate-500">No fines on record.</div>
                            : (
                                <table className="mt-1 w-full">
                                    <tbody>
                                        {detail.fines.map((f) => (
                                            <tr key={f.id}>
                                                <td className="td">{f.violation_type}</td>
                                                <td className="td">{money(f.amount)}</td>
                                                <td className="td text-slate-400">{f.date_issued}</td>
                                                <td className="td">
                                                    <span className={f.paid_status === 'PAID' ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {f.paid_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                        <div className="mt-4 text-sm font-semibold">
                            Recent sightings ({detail.movements.length})
                        </div>
                        <div className="mt-1 max-h-52 overflow-y-auto">
                            {detail.movements.slice(0, 40).map((m) => (
                                <div key={m.id} className="flex justify-between border-t border-line/60 py-1.5 text-xs">
                                    <span>{m.node_label || m.camera_node_id}</span>
                                    <span className="text-slate-500">{m.detected_at}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
