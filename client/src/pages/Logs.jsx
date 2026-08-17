import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';

const EVENT_BADGE = {
    detection: 'blue', alert: 'red', notification: 'amber', toll: 'green', corridor: 'green',
};

export default function Logs() {
    const [q, setQ] = useState('');
    const [eventType, setEventType] = useState('');
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        const params = new URLSearchParams({ q, page, limit, ...(eventType ? { event_type: eventType } : {}) });
        const handle = setTimeout(() => {
            api.get(`/logs?${params}`).then((res) => {
                setData(res.data);
                setTotal(res.total);
            });
        }, 250);
        return () => clearTimeout(handle);
    }, [q, eventType, page, limit]);

    return (
        <>
            <PageHeader title="Full Logs" subtitle="Searchable event log across detections, alerts, notifications, toll and green-corridor events" />
            <div className="content">
                <div className="toolbar">
                    <input
                        style={{ width: 280 }}
                        placeholder="Filter by plate number…"
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setPage(1); }}
                    />
                    <select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }}>
                        <option value="">All event types</option>
                        <option value="detection">Detection</option>
                        <option value="alert">Alert</option>
                        <option value="notification">Notification</option>
                        <option value="toll">Toll</option>
                        <option value="corridor">Green corridor</option>
                    </select>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <ImportExportBar exportEntity="detections" exportLabel="Export detections" />
                        <ImportExportBar exportEntity="alerts" exportLabel="Export alerts" />
                    </div>
                </div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Event</th>
                                <th>Plate</th>
                                <th>Location</th>
                                <th>Detail</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row) => (
                                <tr key={`${row.event_type}-${row.id}`}>
                                    <td><span className={`badge ${EVENT_BADGE[row.event_type]}`}>{row.event_type}</span></td>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{row.plate_number}</td>
                                    <td>{row.location || '—'}</td>
                                    <td>{row.detail || '—'}</td>
                                    <td>{row.occurred_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && <div className="empty-state">No log entries match this search.</div>}
                </div>
                <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
            </div>
        </>
    );
}
