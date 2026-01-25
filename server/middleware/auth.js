const admin = require('../config/firebase');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Create user if not exists in MongoDB (sync)
      user = await User.create({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Unknown User',
        role: decodedToken.role || 'engineer'
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
