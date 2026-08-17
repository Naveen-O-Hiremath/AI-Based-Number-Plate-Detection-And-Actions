import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user);
    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
});

router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

export default router;
