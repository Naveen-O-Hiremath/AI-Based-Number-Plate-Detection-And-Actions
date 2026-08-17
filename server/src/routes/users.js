import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireRole('admin'), (req, res) => {
    const rows = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
    res.json({ data: rows });
});

router.post('/', requireRole('admin'), (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !['admin', 'operator', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'name, email, password, and a valid role are required' });
    }
    try {
        const result = db.prepare(`
            INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)
        `).run(name, email, bcrypt.hashSync(password, 10), role);
        res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        throw err;
    }
});

router.patch('/:id/role', requireRole('admin'), (req, res) => {
    const { role } = req.body || {};
    if (!['admin', 'operator', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
    if (Number(req.params.id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
});

export default router;
