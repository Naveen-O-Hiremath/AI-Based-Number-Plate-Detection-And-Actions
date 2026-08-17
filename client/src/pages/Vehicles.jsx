import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';

export default function Vehicles() {
    const [search, setSearch] = useState('');
    const [data, setData] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const [limit, setLimit] = useState(20);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const params = new URLSearchParams({ page, limit, ...(search ? { search } : {}) });
        const handle = setTimeout(() => {
            api.get(`/vehicles?${params}`).then((res) => {
                setData(res.data);
                setTotal(res.total);
            });
        }, 250);
        return () => clearTimeout(handle);
    }, [page, search, limit, refresh]);

    function openVehicle(plate) {
        api.get(`/vehicles/${plate}`).then(setSelected);
    }

    const today = new Date();
    function expiryBadge(dateStr) {
        const d = new Date(dateStr);
        const days = (d - today) / (1000 * 60 * 60 * 24);
        if (days < 0) return <span className="badge red">Expired</span>;
        if (days < 30) return <span className="badge amber">Due soon</span>;
        return <span className="badge green">Valid</span>;
    }

    return (
        <>
            <PageHeader title="Vehicle Lookup" subtitle="Plate-to-owner lookup across the registered vehicle database" />
            <div className="content">
                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <input
                        style={{ width: 320 }}
                        placeholder="Search by plate number or owner name…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                    <ImportExportBar exportEntity="vehicles" importEntity="vehicles" onImported={() => { setPage(1); setRefresh((r) => r + 1); }} />
                </div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Owner</th>
                                <th>Vehicle</th>
                                <th>Insurance</th>
                                <th>Permit</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((v) => (
                                <tr key={v.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{v.plate_number}</td>
                                    <td>{v.owner_name}</td>
                                    <td>{v.color} {v.make} {v.model}</td>
                                    <td>{expiryBadge(v.insurance_expiry)}</td>
                                    <td>{expiryBadge(v.permit_expiry)}</td>
                                    <td><button className="btn secondary small" onClick={() => openVehicle(v.plate_number)}>Details</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length === 0 && <div className="empty-state">No vehicles match this search.</div>}
                </div>
                <Pagination page={page} limit={limit} total={total} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
            </div>

            {selected && (
                <div className="modal-backdrop" onClick={() => setSelected(null)}>
                    <div className="modal" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
                        <h2>{selected.vehicle.plate_number}</h2>
                        {selected.onWatchlist && (
                            <div className="error-banner">⚠ On rogue-plate watchlist: {selected.onWatchlist.reason}</div>
                        )}
                        <p><strong>Owner:</strong> {selected.vehicle.owner_name}<br />
                        <strong>Phone:</strong> {selected.vehicle.owner_phone}<br />
                        <strong>Address:</strong> {selected.vehicle.owner_address}</p>
                        <p><strong>Vehicle:</strong> {selected.vehicle.color} {selected.vehicle.make} {selected.vehicle.model} ({selected.vehicle.vehicle_type})</p>
                        <p>
                            <strong>Insurance expiry:</strong> {selected.vehicle.insurance_expiry} {expiryBadge(selected.vehicle.insurance_expiry)}<br />
                            <strong>Permit expiry:</strong> {selected.vehicle.permit_expiry} {expiryBadge(selected.vehicle.permit_expiry)}<br />
                            <strong>PUC expiry:</strong> {selected.vehicle.puc_expiry} {expiryBadge(selected.vehicle.puc_expiry)}
                        </p>
                        <div className="section-title" style={{ marginTop: 16, fontSize: 13 }}>Recent detections</div>
                        <table>
                            <tbody>
                                {selected.recentDetections.slice(0, 6).map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.camera_location}</td>
                                        <td>{d.captured_at}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="modal-actions">
                            <button className="btn secondary" onClick={() => setSelected(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
