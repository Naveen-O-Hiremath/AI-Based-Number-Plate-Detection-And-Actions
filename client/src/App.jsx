import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext.jsx';
import { RequireAuth, RequireRole } from './components/RequireAuth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveScan from './pages/LiveScan.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Watchlist from './pages/Watchlist.jsx';
import Compliance from './pages/Compliance.jsx';
import Emergency from './pages/Emergency.jsx';
import Toll from './pages/Toll.jsx';
import Logs from './pages/Logs.jsx';
import Users from './pages/Users.jsx';

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/"
                        element={
                            <RequireAuth>
                                <Layout />
                            </RequireAuth>
                        }
                    >
                        <Route index element={<Dashboard />} />
                        <Route path="live-scan" element={<LiveScan />} />
                        <Route path="vehicles" element={<Vehicles />} />
                        <Route path="watchlist" element={<Watchlist />} />
                        <Route path="compliance" element={<Compliance />} />
                        <Route path="emergency" element={<Emergency />} />
                        <Route path="toll" element={<Toll />} />
                        <Route path="logs" element={<Logs />} />
                        <Route
                            path="users"
                            element={
                                <RequireRole role="admin">
                                    <Users />
                                </RequireRole>
                            }
                        />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}
