import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('admin@anpr-demo.gov.in');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <h1>ANPR Admin Console</h1>
                <p className="sub">AI-Powered Vehicle Number Plate Detection & Alert System</p>
                {error && <div className="error-banner">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label>Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button className="btn" style={{ width: '100%' }} disabled={busy}>
                        {busy ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
                <div className="demo-hint">
                    Demo accounts (seeded, all fictional data):<br />
                    <code>admin@anpr-demo.gov.in</code> / admin123 — Full Access<br />
                    <code>operator@anpr-demo.gov.in</code> / operator123 — Write<br />
                    <code>viewer@anpr-demo.gov.in</code> / viewer123 — Reader
                </div>
            </div>
        </div>
    );
}
