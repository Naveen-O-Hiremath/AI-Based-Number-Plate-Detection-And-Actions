import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV_ITEMS = [
    { section: 'Overview', items: [
        { to: '/', label: 'Dashboard', icon: '▦' },
    ]},
    { section: 'Detection', items: [
        { to: '/live-scan', label: 'Live Camera Scan', icon: '📷' },
        { to: '/vehicles', label: 'Vehicle Lookup', icon: '⛵' },
        { to: '/logs', label: 'Full Logs', icon: '≡' },
    ]},
    { section: 'Modules', items: [
        { to: '/watchlist', label: 'Rogue Plate Alerts', icon: '⚠' },
        { to: '/compliance', label: 'Compliance', icon: '✓' },
        { to: '/emergency', label: 'Green Corridor', icon: '✚' },
        { to: '/toll', label: 'Toll Integration', icon: '⌂' },
    ]},
    { section: 'Administration', items: [
        { to: '/users', label: 'Users & Roles', icon: '●', minRole: 'admin' },
    ]},
];

export default function Layout() {
    const { user, logout, hasRole } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/login');
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <span className="brand-badge">AI</span>
                    ANPR Console
                </div>
                <nav>
                    {NAV_ITEMS.map((section) => {
                        const visibleItems = section.items.filter((i) => !i.minRole || hasRole(i.minRole));
                        if (!visibleItems.length) return null;
                        return (
                            <div key={section.section}>
                                <div className="nav-section-label">{section.section}</div>
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        end={item.to === '/'}
                                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                                    >
                                        <span>{item.icon}</span> {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </nav>
                <div className="sidebar-footer">
                    <div className="user-chip">
                        <div className="user-avatar">{user?.name?.[0] || '?'}</div>
                        <div>
                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{user?.name}</div>
                            <span className={`role-pill ${user?.role}`}>{user?.role}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>Log out</button>
                </div>
            </aside>
            <div className="main">
                <Outlet />
            </div>
        </div>
    );
}
