import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const SEVERITY_BADGE = { low: 'grey', medium: 'amber', high: 'red', critical: 'red' };

function AddModal({ onClose, onAdded }) {
    const [plate, setPlate] = useState('');
    const [reason, setReason] = useState('');
    const [severity, setSeverity] = useState('medium');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await api.post('/watchlist', { plate_number: plate.toUpperCase(), reason, severity });
            onAdded();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Add to watchlist</h2>
                {error && <div className="error-banner">{error}</div>}
                <form onSubmit={submit}>
                    <div className="field">
                        <label>Plate number</label>
                        <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="KA05AI2026" required />
                    </div>
                    <div className="field">
                        <label>Reason</label>
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reported stolen vehicle" required />
                    </div>
                    <div className="field">
                        <label>Severity</label>
                        <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
                        <button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add plate'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function Watchlist() {
    const { hasRole } = useAuth();
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [severity, setSeverity] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [limit, setLimit] = useState(20);

    function load() {
        const params = new URLSearchParams({ page, limit, ...(severity ? { severity } : {}) });
        api.get(`/watchlist?${params}`).then((res) => {
            setData(res.data);
            setTotal(res.total);
        });
    }

    useEffect(load, [page, severity, limit]);

    async function toggleActive(entry) {
        await api.patch(`/watchlist/${entry.id}`, { active: entry.active ? 0 : 1 });
        load();
    }

    return (
        <>
            <PageHeader
                title="Rogue Plate Alerts"
                subtitle="Watchlist of criminal / wanted vehicles — any camera hit triggers an instant alert"
                actions={hasRole('operator') && <button className="btn" onClick={() => setShowAdd(true)}>+ Add plate</button>}
            />
            <div className="content">
                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
                        <option value="">All severities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                    </select>
                    <ImportExportBar exportEntity="watchlist" importEntity="watchlist" onImported={load} />
                </div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Reason</th>
                                <th>Severity</th>
                                <th>Alerts triggered</th>
                                <th>Added by</th>
                                <th>Status</th>
                                {hasRole('operator') && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((w) => (
                                <tr key={w.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{w.plate_number}</td>
                                    <td>{w.reason}</td>
                                    <td><span className={`badge ${SEVERITY_BADGE[w.severity]}`}>{w.severity}</span></td>
                                    <td>{w.alert_count}</td>
                                    <td>{w.added_by_name || '—'}</td>
                                    <td><span className={`badge ${w.active ? 'green' : 'grey'}`}>{w.active ? 'Active' : 'Inactive'}</span></td>
                                    {hasRole('operator') && (
                                        <td>
                                            <button className="btn secondary small" onClick={() => toggleActive(w)}>
                                                {w.active ? 'Deactivate' : 'Reactivate'}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && <div className="empty-state">No watchlist entries match this filter.</div>}
                </div>
                <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
            </div>
            {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={load} />}
        </>
    );
}
