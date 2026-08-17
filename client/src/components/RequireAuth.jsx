import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export function RequireAuth({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="content">Loading…</div>;
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

export function RequireRole({ role, children }) {
    const { hasRole } = useAuth();
    if (!hasRole(role)) {
        return (
            <div className="access-denied">
                <h2>Access restricted</h2>
                <p>Your role does not have permission to view this page.</p>
            </div>
        );
    }
    return children;
}
