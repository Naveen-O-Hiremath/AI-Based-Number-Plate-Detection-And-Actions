import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import ImportExportBar from '../components/ImportExportBar.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

const FLEET_BADGE = { ambulance: 'red', fire: 'amber', police: 'blue' };

export default function Emergency() {
    const { hasRole } = useAuth();
    const [fleet, setFleet] = useState([]);
    const [fleetTotal, setFleetTotal] = useState(0);
    const [fleetPage, setFleetPage] = useState(1);
    const [fleetLimit, setFleetLimit] = useState(20);
    const [events, setEvents] = useState([]);
    const [eventsTotal, setEventsTotal] = useState(0);
    const [eventsPage, setEventsPage] = useState(1);
    const [eventsLimit, setEventsLimit] = useState(20);
    const [filter, setFilter] = useState('');

    function load() {
        const fleetParams = new URLSearchParams({ page: fleetPage, limit: fleetLimit, ...(filter ? { fleet_type: filter } : {}) });
        api.get(`/emergency-vehicles?${fleetParams}`).then((res) => {
            setFleet(res.data);
            setFleetTotal(res.total ?? res.data.length);
        });
        const eventParams = new URLSearchParams({ page: eventsPage, limit: eventsLimit });
        api.get(`/emergency-vehicles/corridor-events?${eventParams}`).then((res) => {
            setEvents(res.data);
            setEventsTotal(res.total ?? res.data.length);
        });
    }

    useEffect(load, [filter, fleetPage, fleetLimit, eventsPage, eventsLimit]);

    async function toggleDuty(v) {
        await api.patch(`/emergency-vehicles/${v.id}/duty`, { on_duty: v.on_duty ? 0 : 1 });
        load();
    }

    return (
        <>
            <PageHeader title="Green Corridor" subtitle="Registered ambulances and emergency vehicles get automatic signal priority while on duty" />
            <div className="content">
                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                    <select value={filter} onChange={(e) => { setFilter(e.target.value); setFleetPage(1); }}>
                        <option value="">All fleet types</option>
                        <option value="ambulance">Ambulance</option>
                        <option value="fire">Fire</option>
                        <option value="police">Police</option>
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <ImportExportBar exportEntity="emergency" exportLabel="Export fleet" />
                        <ImportExportBar exportEntity="corridor" exportLabel="Export events" />
                    </div>
                </div>

                <div className="section-title">Registered fleet</div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Type</th>
                                <th>Driver</th>
                                <th>Driver app ID</th>
                                <th>Corridors granted</th>
                                <th>Duty status</th>
                                {hasRole('operator') && <th></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {fleet.map((v) => (
                                <tr key={v.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{v.plate_number}</td>
                                    <td><span className={`badge ${FLEET_BADGE[v.fleet_type]}`}>{v.fleet_type}</span></td>
                                    <td>{v.driver_name}</td>
                                    <td>{v.driver_app_id}</td>
                                    <td>{v.corridor_count}</td>
                                    <td>
                                        <span className="duty-toggle">
                                            <span className={`dot ${v.on_duty ? 'on' : 'off'}`}></span>
                                            {v.on_duty ? 'On duty' : 'Off duty'}
                                        </span>
                                    </td>
                                    {hasRole('operator') && (
                                        <td>
                                            <button className="btn secondary small" onClick={() => toggleDuty(v)}>
                                                {v.on_duty ? 'End duty' : 'Start duty'}
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {fleet.length === 0 && <div className="empty-state">No emergency vehicles registered.</div>}
                </div>
                <Pagination page={fleetPage} limit={fleetLimit} total={fleetTotal} onPageChange={setFleetPage} onLimitChange={(l) => { setFleetLimit(l); setFleetPage(1); }} />

                <div className="section-title">Recent green corridor events</div>
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Plate</th>
                                <th>Fleet</th>
                                <th>Driver</th>
                                <th>Camera / signal</th>
                                <th>Granted at</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.id}>
                                    <td style={{ fontFamily: 'var(--mono)' }}>{ev.plate_number}</td>
                                    <td><span className={`badge ${FLEET_BADGE[ev.fleet_type]}`}>{ev.fleet_type}</span></td>
                                    <td>{ev.driver_name}</td>
                                    <td>{ev.camera_location} · {ev.signal_id}</td>
                                    <td>{ev.granted_at}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {events.length === 0 && <div className="empty-state">No green corridor events yet.</div>}
                </div>
                <Pagination page={eventsPage} limit={eventsLimit} total={eventsTotal} onPageChange={setEventsPage} onLimitChange={(l) => { setEventsLimit(l); setEventsPage(1); }} />
            </div>
        </>
    );
}
