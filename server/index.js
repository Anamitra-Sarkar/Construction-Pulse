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

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('io', io);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.66pozh2.mongodb.net/quality_pulse?retryWrites=true&w=majority';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const analyticsRoutes = require('./routes/analytics');
const auditRoutes = require('./routes/audit');
const governanceRoutes = require('./routes/governance');

app.use('/api/governance', governanceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sites', verifyToken, siteRoutes);
app.use('/api/reports', verifyToken, reportRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);
app.use('/api/analytics', verifyToken, analyticsRoutes);
app.use('/api/audit', verifyToken, auditRoutes);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
