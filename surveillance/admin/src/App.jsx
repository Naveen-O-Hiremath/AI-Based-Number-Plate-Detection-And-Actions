import { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useSocket, playAlertTone } from './lib/useSocket.js';
import { api } from './lib/api.js';
import AlertBanner from './components/AlertBanner.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tracking from './pages/Tracking.jsx';
import Directory from './pages/Directory.jsx';
import Alerts from './pages/Alerts.jsx';
import AuditLog from './pages/AuditLog.jsx';

const NAV = [
    { to: '/', label: 'Live Dashboard', end: true },
    { to: '/tracking', label: 'Surveillance Tracking' },
    { to: '/directory', label: 'Vehicle Directory' },
    { to: '/alerts', label: 'Alerts' },
    { to: '/audit', label: 'Audit & Export' },
];

export default function App() {
    const [feed, setFeed] = useState([]);
    const [activeAlert, setActiveAlert] = useState(null);
    const [alertCount, setAlertCount] = useState(0);

    const handleEvent = useCallback((message) => {
        if (message.type === 'detection' || message.type === 'critical_alert') {
            const item = { ...message.payload, _type: message.type, _at: message.at, _key: `${message.at}-${Math.random()}` };
            // critical_alert and detection both fire for a WANTED hit; keep the
            // richer critical_alert and drop the duplicate detection row.
            setFeed((prev) => {
                if (message.type === 'detection' && prev[0]?._type === 'critical_alert'
                    && prev[0].plate_number === item.plate_number) return prev;
                return [item, ...prev].slice(0, 60);
            });
        }
        if (message.type === 'critical_alert') {
            setActiveAlert(message.payload);
            setAlertCount((c) => c + 1);
            playAlertTone();
        }
    }, []);

    const { connected } = useSocket(handleEvent);

    async function acknowledge(alert) {
        if (alert?.alert?.id) {
            try { await api.patch(`/alerts/${alert.alert.id}/acknowledge`); } catch { /* non-fatal */ }
        }
        setActiveAlert(null);
    }

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-ink-900 text-slate-100">
                {activeAlert && (
                    <AlertBanner alert={activeAlert} onDismiss={() => acknowledge(activeAlert)} />
                )}

                <header className="border-b border-line bg-ink-800/80 backdrop-blur sticky top-0 z-30">
                    <div className="mx-auto max-w-[1500px] px-6 py-3 flex items-center gap-6">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-amber-400 text-ink-900 grid place-items-center font-black text-xs">
                                AI
                            </div>
                            <div>
                                <div className="font-bold leading-tight">ANPR Surveillance</div>
                                <div className="text-[11px] text-slate-400 leading-tight">Control Room</div>
                            </div>
                        </div>

                        <nav className="flex gap-1 flex-1">
                            {NAV.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `px-3 py-1.5 rounded-lg text-sm transition ${
                                            isActive
                                                ? 'bg-ink-600 text-white font-semibold'
                                                : 'text-slate-400 hover:text-slate-100 hover:bg-ink-700'
                                        }`
                                    }
                                >
                                    {item.label}
                                    {item.to === '/alerts' && alertCount > 0 && (
                                        <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                            {alertCount}
                                        </span>
                                    )}
                                </NavLink>
                            ))}
                        </nav>

                        <div className="flex items-center gap-2 text-xs">
                            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400' : 'bg-red-500'}`} />
                            <span className={connected ? 'text-emerald-300' : 'text-red-300'}>
                                {connected ? 'Live' : 'Reconnecting…'}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-[1500px] px-6 py-6">
                    <Routes>
                        <Route path="/" element={<Dashboard feed={feed} connected={connected} />} />
                        <Route path="/tracking" element={<Tracking />} />
                        <Route path="/directory" element={<Directory />} />
                        <Route path="/alerts" element={<Alerts />} />
                        <Route path="/audit" element={<AuditLog />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
