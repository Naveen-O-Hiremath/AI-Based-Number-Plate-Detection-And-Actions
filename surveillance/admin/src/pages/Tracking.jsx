import { useEffect, useState } from 'react';
import { api, statusStyle, timeAgo } from '../lib/api.js';

/**
 * Map-like path view: camera nodes are plotted by their lat/lng onto a
 * normalized canvas, and the vehicle's sightings are joined in time order.
 */
function PathMap({ trail }) {
    const points = trail.filter((t) => t.lat != null && t.lng != null);
    if (points.length < 1) {
        return (
            <div className="grid h-full place-items-center text-xs text-slate-500">
                No geo-located sightings for this vehicle
            </div>
        );
    }

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
    const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
    const spanLat = maxLat - minLat || 0.01;
    const spanLng = maxLng - minLng || 0.01;
    const pad = 12;
    const W = 300, H = 190;

    // Oldest → newest so the drawn path reads in travel order.
    const ordered = [...points].reverse();
    const xy = ordered.map((p) => ({
        ...p,
        x: pad + ((p.lng - minLng) / spanLng) * (W - pad * 2),
        y: H - pad - ((p.lat - minLat) / spanLat) * (H - pad * 2),
    }));

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M20 0 L0 0 0 20" fill="none" stroke="#223049" strokeWidth="0.5" />
                </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />
            <polyline
                points={xy.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none" stroke="#3b82f6" strokeWidth="1.5"
                strokeDasharray="4 3" opacity="0.8"
            />
            {xy.map((p, i) => {
                const isLatest = i === xy.length - 1;
                return (
                    <g key={`${p.camera_node_id}-${p.detected_at}-${i}`}>
                        <circle
                            cx={p.x} cy={p.y} r={isLatest ? 5 : 3.5}
                            fill={isLatest ? '#ef4444' : '#3b82f6'}
                            stroke="#0a0f1c" strokeWidth="1.5"
                        />
                        {isLatest && (
                            <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="#ef4444"
                                    strokeWidth="1" opacity="0.6" />
                        )}
                        <text x={p.x + 7} y={p.y - 5} fontSize="6.5" fill="#94a3b8">
                            {p.camera_node_id}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

export default function Tracking() {
    const [trails, setTrails] = useState([]);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        api.get('/surveillance/trails').then((r) => {
            setTrails(r.data);
            setSelected(r.data[0] || null);
        }).catch(() => {});
    }, []);

    const visible = trails.filter(
        (t) => !filter || t.plate_number.includes(filter.toUpperCase()) ||
               t.owner_name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <div className="card flex max-h-[calc(100vh-160px)] flex-col">
                <div className="mb-3">
                    <div className="mb-2 text-sm font-semibold">Flagged vehicles</div>
                    <input
                        className="input w-full"
                        placeholder="Filter by plate or owner…"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    />
                </div>
                <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {visible.map((t) => {
                        const style = statusStyle(t.status);
                        const active = selected?.plate_number === t.plate_number;
                        return (
                            <button
                                key={t.plate_number}
                                onClick={() => setSelected(t)}
                                className={`w-full rounded-lg p-2.5 text-left transition ${
                                    active ? 'bg-ink-600 ring-1 ring-blue-500/50' : 'bg-ink-800/60 hover:bg-ink-600'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="mono text-sm font-semibold">{t.plate_number}</span>
                                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-slate-400">{t.owner_name}</div>
                                <div className="mt-0.5 text-[10px] text-slate-500">
                                    {t.trail.length} sightings · {timeAgo(t.trail[0]?.detected_at)}
                                </div>
                            </button>
                        );
                    })}
                    {visible.length === 0 && (
                        <div className="py-10 text-center text-xs text-slate-500">No flagged vehicles match.</div>
                    )}
                </div>
            </div>

            {selected ? (
                <div className="space-y-4">
                    <div className="card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="mono text-2xl font-bold tracking-wide">
                                        {selected.plate_number}
                                    </span>
                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle(selected.status).chip}`}>
                                        {statusStyle(selected.status).label}
                                    </span>
                                </div>
                                <div className="mt-1 text-sm text-slate-300">
                                    {selected.owner_name} · {selected.vehicle_model}
                                </div>
                                {selected.status_reason && (
                                    <div className="mt-1 text-xs text-amber-300/90">{selected.status_reason}</div>
                                )}
                            </div>
                            <div className="text-right text-xs text-slate-400">
                                <div className="text-lg font-bold text-slate-200">{selected.trail.length}</div>
                                <div>sightings logged</div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="card">
                            <div className="mb-2 text-sm font-semibold">Movement path</div>
                            <div className="h-[190px]"><PathMap trail={selected.trail} /></div>
                            <div className="mt-2 flex gap-4 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-red-500" /> latest sighting
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="h-2 w-2 rounded-full bg-blue-500" /> earlier
                                </span>
                            </div>
                        </div>

                        <div className="card flex max-h-[260px] flex-col">
                            <div className="mb-2 text-sm font-semibold">Timeline</div>
                            <div className="flex-1 overflow-y-auto pr-1">
                                <ol className="relative border-l border-line pl-4">
                                    {selected.trail.map((t, i) => (
                                        <li key={`${t.detected_at}-${i}`} className="mb-3 last:mb-0">
                                            <span className={`absolute -left-[4.5px] mt-1.5 h-2 w-2 rounded-full ${
                                                i === 0 ? 'bg-red-500' : 'bg-slate-600'
                                            }`} />
                                            <div className="text-xs font-medium text-slate-200">
                                                {t.node_label || t.camera_node_id}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {t.node_location || '—'} · {t.detected_at}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card grid place-items-center text-sm text-slate-500">
                    Select a flagged vehicle to view its movement history.
                </div>
            )}
        </div>
    );
}
