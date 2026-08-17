import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'anpr-demo-dev-secret-change-in-production';

// Role hierarchy: admin (Full Access) > operator (Write) > viewer (Reader)
const ROLE_RANK = { viewer: 1, operator: 2, admin: 3 };

export function signToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '12h' }
    );
}

export function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authentication token' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Usage: requireRole('operator') allows operator and admin (rank >= operator).
export function requireRole(minRole) {
    const minRank = ROLE_RANK[minRole] ?? 999;
    return (req, res, next) => {
        const rank = ROLE_RANK[req.user?.role] ?? 0;
        if (rank < minRank) {
            return res.status(403).json({ error: 'Insufficient permissions for this action' });
        }
        next();
    };
}
