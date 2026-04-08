import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ override: true });

export const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to authenticate JWT token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' 
        ? 'Token expired' 
        : 'Invalid or expired token';
      return res.status(403).json({ message });
    }
    
    // Set user info on request
    req.user = decoded;
    next();
  });
}

/**
 * Middleware to authenticate JWT token (optional)
 * Doesn't fail if token is missing, just sets req.user if present
 */
export function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // If token is invalid/expired, we don't set user but continue
      return next();
    }
    
    req.user = decoded;
    next();
  });
}

/**
 * Middleware to restrict access to specific roles
 * @param {string[]} roles - Array of allowed roles
 */
export function authorize(roles = []) {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user || (roles.length && !roles.includes(req.user.role))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
}
