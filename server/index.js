require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { verifyToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

/* ======================
   GLOBAL MIDDLEWARE
====================== */
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('io', io);

/* ======================
   DATABASE
====================== */
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://admin:admin123@cluster0.66pozh2.mongodb.net/quality_pulse?retryWrites=true&w=majority';

const { seedDefaultPolicies } = require('./utils/governance');

mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    // Seed default governance policies on every startup
    // Uses upsert, so safe to call repeatedly (idempotent)
    await seedDefaultPolicies();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

/* ======================
   ROUTES
====================== */
const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const auditRoutes = require('./routes/audit');
const governanceRoutes = require('./routes/governance');

/**
 * 🚨 GOVERNANCE ROUTES
 * MUST be public
 * MUST be mounted first
 * MUST never use verifyToken
 */
app.use('/api/governance', governanceRoutes);

/**
 * AUTH ROUTES
 */
app.use('/api/auth', authRoutes);

/**
 * PROTECTED ROUTES
 */
app.use('/api/sites', verifyToken, siteRoutes);
app.use('/api/reports', verifyToken, reportRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);
app.use('/api/analytics', verifyToken, analyticsRoutes);
app.use('/api/audit', verifyToken, auditRoutes);

/* ======================
   SYSTEM ROUTES
====================== */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Construction Quality Pulse API'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/* ======================
   SOCKET.IO
====================== */
io.on('connection', socket => {
  console.log('Socket connected:', socket.id);

  socket.on('join', userId => {
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

/* ======================
   SERVER START
====================== */
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
