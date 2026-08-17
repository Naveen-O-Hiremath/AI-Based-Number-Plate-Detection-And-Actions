import { money } from '../lib/api.js';

/** Full-width blocking banner for a WANTED_CRIMINAL detection. */
export default function AlertBanner({ alert, onDismiss }) {
    const v = alert.vehicle || {};
    return (
        <div className="sticky top-0 z-50 animate-slide-in border-b-2 border-red-400 bg-red-600 text-white shadow-2xl shadow-red-900/50">
            <div className="mx-auto flex max-w-[1500px] items-center gap-5 px-6 py-3.5">
                <div className="grid h-11 w-11 shrink-0 animate-pulse-alert place-items-center rounded-full bg-white/20 text-2xl">
                    ⚠
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                            Critical — Wanted Vehicle Detected
                        </span>
                        <span className="mono text-xl font-bold tracking-wide">{alert.plate_number}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-red-50">
                        {v.vehicle_model}{v.vehicle_color ? ` · ${v.vehicle_color}` : ''} · Owner: {v.owner_name}
                        {' · '}Camera <span className="font-semibold">{alert.camera_node_id}</span>
                        {alert.fines?.amount_due > 0 && ` · ${money(alert.fines.amount_due)} unpaid`}
                    </div>
                    {alert.alert?.reason && (
                        <div className="mt-0.5 text-xs text-red-100/90">Reason: {alert.alert.reason}</div>
                    )}
                </div>

                <button
                    onClick={onDismiss}
                    className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                >
                    Acknowledge
                </button>
            </div>
        </div>
    );
}
