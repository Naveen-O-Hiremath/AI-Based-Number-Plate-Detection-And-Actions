import { useEffect, useState } from 'react';
import { api, statusStyle, timeAgo, money } from '../lib/api.js';

function Stat({ label, value, tone = 'text-slate-100', sub }) {
    return (
        <div className="card">
            <div className={`text-2xl font-bold ${tone}`}>{value}</div>
            <div className="mt-1 text-xs text-slate-400">{label}</div>
            {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
        </div>
    );
}

/** Compact bar chart of detections per day — no chart library needed. */
function DetectionsChart({ data }) {
    const max = Math.max(1, ...data.map((d) => d.count));
    return (
        <div className="card">
            <div className="mb-3 text-sm font-semibold">Detections · last 14 days</div>
            <div className="flex h-28 items-end gap-1.5">
                {data.map((d) => (
                    <div key={d.day} className="group relative flex-1" title={`${d.day}: ${d.count}`}>
                        <div
                            className="w-full rounded-t bg-blue-500/70 transition group-hover:bg-blue-400"
                            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-500">
                <span>{data[0]?.day}</span>
                <span>{data[data.length - 1]?.day}</span>
            </div>
        </div>
    );
}

function FeedRow({ item }) {
    const style = statusStyle(item.status);
    const v = item.vehicle || {};
    return (
        <div className={`animate-slide-in rounded-lg bg-ink-800/70 p-3 ${style.row}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="mono text-base font-bold tracking-wide">
                            {item.plate_number || '— no plate —'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.chip}`}>
                            {style.label}
                        </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-400">
                        {item.matched
                            ? `${v.owner_name} · ${v.vehicle_model}`
                            : item.message || 'Not in registry'}
                    </div>
                </div>
                <div className="shrink-0 text-right text-[11px] text-slate-500">
                    <div>{item.camera_node_id}</div>
                    <div>{timeAgo(item._at)}</div>
                    {item.vision_source && (
                        <div className="mt-0.5 text-[10px] text-slate-600">{item.vision_source}</div>
                    )}
                </div>
            </div>
            {item.fines?.total_unpaid > 0 && (
                <div className="mt-2 inline-block rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                    {item.fines.total_unpaid} unpaid fine{item.fines.total_unpaid > 1 ? 's' : ''} · {money(item.fines.amount_due)}
                </div>
            )}
        </div>
    );
}

export default function Dashboard({ feed, connected }) {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        const load = () => api.get('/stats').then(setStats).catch(() => {});
        load();
        const t = setInterval(load, 15000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <Stat label="Registered vehicles" value={stats?.vehicles?.toLocaleString() ?? '—'} />
                <Stat label="Wanted / criminal" value={stats?.wanted ?? '—'} tone="text-red-400" />
                <Stat label="Under surveillance" value={stats?.surveillance ?? '—'} tone="text-amber-400" />
                <Stat label="Open alerts" value={stats?.open_alerts ?? '—'} tone="text-red-400"
                      sub={`${stats?.total_alerts ?? 0} total`} />
                <Stat label="Detections today" value={stats?.detections_today ?? '—'} tone="text-blue-400"
                      sub={`${stats?.detections?.toLocaleString() ?? 0} all time`} />
                <Stat label="Unpaid fines" value={money(stats?.amount_due)} tone="text-amber-400"
                      sub={`${stats?.unpaid_fines ?? 0} pending`} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
                <div className="space-y-5">
                    {stats?.detections_by_day?.length > 0 && (
                        <DetectionsChart data={stats.detections_by_day} />
                    )}

                    <div className="card">
                        <div className="mb-3 text-sm font-semibold">Camera nodes · busiest</div>
                        <div className="space-y-2">
                            {(stats?.top_nodes || []).map((n) => {
                                const max = Math.max(...(stats.top_nodes.map((x) => x.count) || [1]));
                                return (
                                    <div key={n.camera_node_id} className="flex items-center gap-3">
                                        <span className="mono w-24 shrink-0 text-xs text-slate-400">
                                            {n.camera_node_id}
                                        </span>
                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
                                            <div className="h-full rounded-full bg-blue-500/70"
                                                 style={{ width: `${(n.count / max) * 100}%` }} />
                                        </div>
                                        <span className="w-10 shrink-0 text-right text-xs text-slate-400">
                                            {n.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="card flex max-h-[640px] flex-col">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">Live detection feed</span>
                        <span className="text-[11px] text-slate-500">
                            {connected ? 'streaming via WebSocket' : 'disconnected'}
                        </span>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                        {feed.length === 0 && (
                            <div className="py-16 text-center text-sm text-slate-500">
                                Waiting for detections…
                                <div className="mt-1 text-xs text-slate-600">
                                    Scan a plate from the mobile app to see it appear here instantly.
                                </div>
                            </div>
                        )}
                        {feed.map((item) => <FeedRow key={item._key} item={item} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
