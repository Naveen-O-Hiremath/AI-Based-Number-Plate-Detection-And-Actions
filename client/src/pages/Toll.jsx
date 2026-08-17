import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';

const STATUS_BADGE = { reconciled: 'green', pending: 'amber', failed: 'red' };

export default function Toll() {
    const [nakas, setNakas] = useState([]);
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [nakaId, setNakaId] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        api.get('/toll/nakas').then((res) => setNakas(res.data));
    }, []);

    useEffect(() => {
        const params = new URLSearchParams({ page, limit, ...(nakaId ? { naka_id: nakaId } : {}) });
        api.get(`/toll/transactions?${params}`).then((res) => {
            setData(res.data);
            setTotal(res.total);
        });
    }, [page, nakaId, limit]);

    return (
        <>
            <PageHeader title="Toll Integration" subtitle="The same detection pipeline plugs into toll plazas to identify vehicles and reconcile collection" />
            <div className="content">
                <div className="section-title">Toll nakas</div>
                <div className="stat-grid">
                    {nakas.map((n) => (
                        <div key={n.id} className="stat-card blue">
                            <div className="value">{n.transaction_count.toLocaleString()}</div>
                            <div className="label">{n.name} · {n.highway}</div>
                        </div>
                    ))}
                </div>

                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <select value={nakaId} onChange={(e) => { setNakaId(e.target.value); setPage(1); }}>
                        <option value="">All nakas</option>
                        {nakas.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <ImportExportBar exportEntity="toll" exportLabel="Export transactions" />
                </div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Naka</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((tx) => (
                                <tr key={tx.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{tx.plate_number}</td>
                                    <td>{tx.naka_name}</td>
                                    <td>₹{tx.amount}</td>
                                    <td><span className={`badge ${STATUS_BADGE[tx.status]}`}>{tx.status}</span></td>
                                    <td>{tx.occurred_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && <div className="empty-state">No transactions match this filter.</div>}
                </div>
                <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
            </div>
        </>
    );
}
