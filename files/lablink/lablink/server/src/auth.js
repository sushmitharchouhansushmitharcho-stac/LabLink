import jwt from 'jsonwebtoken';
import { User } from './models.js';
const SECRET = process.env.JWT_SECRET || 'dev-secret';

export const sign = (u, remember = true) => jwt.sign({ id: u._id }, SECRET, { expiresIn: remember ? '7d' : '12h' });

// auth() = any logged-in user; auth('admin','faculty') = only those roles
export const auth = (...roles) => async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    req.user = await User.findById(jwt.verify(token, SECRET).id);
    if (!req.user || !req.user.active) throw new Error();
  } catch { return res.status(401).json({ message: 'Please log in to continue' }); }
  if (roles.length && !roles.includes(req.user.role))
    return res.status(403).json({ message: 'You are not authorised to do this' });
  next();
};
