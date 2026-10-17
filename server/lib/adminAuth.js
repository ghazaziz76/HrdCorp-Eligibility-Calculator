// Shared admin auth: header x-admin-password (or body.password) vs ADMIN_PASSWORD.
// The password is read per request so tests and env changes take effect.
const adminPassword = () => process.env.ADMIN_PASSWORD || 'admin123';

const auth = (req, res, next) => {
    const pw = req.headers['x-admin-password'] || (req.body && req.body.password);
    if (pw !== adminPassword()) return res.status(401).json({ error: 'Invalid password' });
    next();
};

module.exports = { auth, adminPassword };
