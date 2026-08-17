import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken } from '../api/client.js';

const AuthContext = createContext(null);

const ROLE_RANK = { viewer: 1, operator: 2, admin: 3 };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/auth/me')
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    async function login(email, password) {
        const data = await api.post('/auth/login', { email, password });
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }

    function logout() {
        setToken(null);
        setUser(null);
    }

    function hasRole(minRole) {
        if (!user) return false;
        return (ROLE_RANK[user.role] ?? 0) >= (ROLE_RANK[minRole] ?? 999);
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
