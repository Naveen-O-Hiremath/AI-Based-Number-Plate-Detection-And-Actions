import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import PageHeader from '../components/PageHeader.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

function AddUserModal({ onClose, onAdded }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(e) {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await api.post('/users', { name, email, password, role });
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
                <h2>Add admin console user</h2>
                {error && <div className="error-banner">{error}</div>}
                <form onSubmit={submit}>
                    <div className="field">
                        <label>Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="viewer">Reader</option>
                            <option value="operator">Write</option>
                            <option value="admin">Full Access</option>
                        </select>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
                        <button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const ROLE_LABEL = { admin: 'Full Access', operator: 'Write', viewer: 'Reader' };
const ROLE_BADGE = { admin: 'red', operator: 'amber', viewer: 'green' };

export default function Users() {
    const { user: me } = useAuth();
    const [users, setUsers] = useState([]);
    const [showAdd, setShowAdd] = useState(false);

    function load() {
        api.get('/users').then((res) => setUsers(res.data));
    }
    useEffect(load, []);

    async function changeRole(u, role) {
        await api.patch(`/users/${u.id}/role`, { role });
        load();
    }

    async function removeUser(u) {
        if (!confirm(`Remove ${u.name}?`)) return;
        await api.delete(`/users/${u.id}`);
        load();
    }

    return (
        <>
            <PageHeader title="Users & Roles" subtitle="Manage admin console accounts and access levels" actions={<button className="btn" onClick={() => setShowAdd(true)}>+ Add user</button>} />
            <div className="content">
                <div className="card">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Created</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.name}</td>
                                    <td>{u.email}</td>
                                    <td>
                                        <select value={u.role} disabled={u.id === me.id} onChange={(e) => changeRole(u, e.target.value)}>
                                            <option value="viewer">Reader</option>
                                            <option value="operator">Write</option>
                                            <option value="admin">Full Access</option>
                                        </select>
                                        {' '}
                                        <span className={`badge ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                                    </td>
                                    <td>{u.created_at}</td>
                                    <td>
                                        {u.id !== me.id && (
                                            <button className="btn danger small" onClick={() => removeUser(u)}>Remove</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onAdded={load} />}
        </>
    );
}
