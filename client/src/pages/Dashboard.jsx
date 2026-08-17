import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import { TrendChart, BarRows } from '../components/Charts.jsx';

// Severity is ordered, so it gets a sequential red ramp (light → deep).
const SEVERITY_RAMP = { low: '#fecaca', medium: '#fca5a5', high: '#f87171', critical: '#ef4444' };
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];
const CAMERA_LABELS = { endpoint: 'Endpoint', mobile: 'Mobile', toll: 'Toll naka' };

function colorLine(line) {
    if (/alert/i.test(line) && /confirmed|dismissed|open/i.test(line)) return 'line-alert';
    if (/notice/i.test(line)) return 'line-amber';
    if (/corridor/i.test(line)) return 'line-green';
    return '';
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        api.get('/dashboard/stats').then(setStats).catch(() => {});
        api.get('/summary/daily').then(setSummary).catch(() => {});
    }, []);

    if (!stats) return <div className="content">Loading…</div>;

    const c = stats.counts;

    return (
        <>
            <PageHeader title="Dashboard" subtitle="Real-time overview of the ANPR network" />
            <div className="content">
                <div className="stat-grid">
                    <div className="stat-card blue">
                        <div className="value">{c.detections.toLocaleString()}</div>
                        <div className="label">Plates read (total)</div>
                    </div>
                    <div className="stat-card blue">
                        <div className="value">{c.onlineCameras} / {c.cameras}</div>
                        <div className="label">Cameras online</div>
                    </div>
                    <div className="stat-card red">
                        <div className="value">{c.openAlerts}</div>
                        <div className="label">Open rogue-plate alerts</div>
                    </div>
                    <div className="stat-card amber">
                        <div className="value">{c.notifications.toLocaleString()}</div>
                        <div className="label">Compliance notices sent</div>
                    </div>
                    <div className="stat-card green">
                        <div className="value">{c.onDutyEmergencyVehicles}</div>
                        <div className="label">Emergency vehicles on duty</div>
                    </div>
                    <div className="stat-card blue">
                        <div className="value">{c.toll_transactions.toLocaleString()}</div>
                        <div className="label">Toll transactions reconciled</div>
                    </div>
                </div>

                <div className="section-title">AI daily summary</div>
                <div className="card">
                    <div className="ai-summary">
                        <div className="comment">// Generated {summary ? new Date(summary.generatedAt).toLocaleString() : '…'}</div>
                        {summary?.lines.map((line, i) => (
                            <div key={i} className={colorLine(line)}>▸ {line}</div>
                        ))}
                    </div>
                </div>

                <div className="section-title">Detections — last 14 days</div>
                <div className="card">
                    <TrendChart data={stats.detectionsByDay} valueLabel="plates read" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
                    <div>
                        <div className="section-title">Rogue-plate alerts by severity</div>
                        <div className="card">
                            <BarRows data={
                                SEVERITY_ORDER
                                    .map((sev) => ({
                                        label: sev,
                                        value: stats.alertsBySeverity.find((s) => s.severity === sev)?.count || 0,
                                        color: SEVERITY_RAMP[sev],
                                    }))
                            } />
                        </div>
                    </div>
                    <div>
                        <div className="section-title">Camera fleet by type</div>
                        <div className="card">
                            <BarRows data={
                                stats.cameraTypeBreakdown.map((c) => ({
                                    label: CAMERA_LABELS[c.type] || c.type,
                                    value: c.count,
                                    color: '#3b82f6',
                                }))
                            } />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
