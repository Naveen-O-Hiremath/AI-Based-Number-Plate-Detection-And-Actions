import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';

const TYPE_BADGE = { insurance: 'amber', permit: 'blue', puc: 'green' };

export default function Compliance() {
    const [stats, setStats] = useState(null);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [type, setType] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        api.get('/compliance/stats').then(setStats);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams({ page, limit, ...(type ? { type } : {}) });
        api.get(`/compliance/notifications?${params}`).then((res) => {
            setData(res.data);
            setTotal(res.total);
        });
    }, [page, type, limit]);

    return (
        <>
            <PageHeader title="Compliance & Notifications" subtitle="Insurance, permit, and PUC expiry verification with automatic owner notices" />
            <div className="content">
                {stats && (
                    <div className="stat-grid">
                        <div className="stat-card amber">
                            <div className="value">{stats.expiringVehicles.toLocaleString()}</div>
                            <div className="label">Vehicles expiring within 30 days</div>
                        </div>
                        {stats.byType.map((s) => (
                            <div key={s.type} className="stat-card blue">
                                <div className="value">{s.count.toLocaleString()}</div>
                                <div className="label" style={{ textTransform: 'capitalize' }}>{s.type} notices sent</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                        <option value="">All notice types</option>
                        <option value="insurance">Insurance</option>
                        <option value="permit">Permit</option>
                        <option value="puc">PUC</option>
                    </select>
                    <ImportExportBar exportEntity="notifications" />
                </div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Owner</th>
                                <th>Type</th>
                                <th>Channel</th>
                                <th>Sent at</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((n) => (
                                <tr key={`${n.type}-${n.id}`}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{n.plate_number}</td>
                                    <td>{n.owner_name}</td>
                                    <td><span className={`badge ${TYPE_BADGE[n.type]}`}>{n.type}</span></td>
                                    <td>{n.channel}</td>
                                    <td>{n.sent_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && <div className="empty-state">No notifications match this filter.</div>}
                </div>
                <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
            </div>
        </>
    );
}
