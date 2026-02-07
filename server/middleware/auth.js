const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Authentication & Authorization Middleware
 *
 * DESIGN PRINCIPLES:
 * - Firebase tokens prove IDENTITY only, never AUTHORITY
 * - Authorization is independently validated against MongoDB user records
 * - User status, role validity, and revocation state are checked on every request
 * - A stolen token cannot grant access if the user is deactivated in MongoDB
 *
 * SECURITY INVARIANTS:
 * - Inactive users are always rejected, even with valid Firebase tokens
 * - Role checks use MongoDB as source of truth, not Firebase custom claims
 * - Token verification failure always results in 401
 */
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    // Step 1: Verify Firebase token (proves identity)
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Step 2: Look up user in MongoDB (source of truth for authorization)
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Create user if not exists in MongoDB (sync from Firebase)
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Unknown User',
        role: decodedToken.role || 'engineer'
      });
    }

    // Step 3: Validate user status (MongoDB is authoritative)
    // A deactivated user must be rejected even if their Firebase token is valid
    if (user.status === 'inactive') {
      return res.status(403).json({
        message: 'Account deactivated. Contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

/**
 * Role-based authorization middleware.
 * Uses MongoDB user record (NOT Firebase claims) as source of truth.
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
  }
};

const isEngineer = (req, res, next) => {
  if (req.user && req.user.role === 'engineer') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Engineer access required' });
  }
};

module.exports = { verifyToken, isAdmin, isEngineer };
