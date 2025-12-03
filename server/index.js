const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const fileRoutes = require('./routes/files');
const keyExchangeRoutes = require('./routes/keyExchange');
const auditRoutes = require('./routes/audit');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/key-exchange', keyExchangeRoutes);
app.use('/api/audit', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });

  // Handle encrypted message delivery
  socket.on('encrypted-message', async (data) => {
    // Broadcast to recipient (in production, verify authentication)
    socket.broadcast.emit('encrypted-message', data);
  });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/e2ee_messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('MongoDB connected successfully');
})
.catch((err) => {
  logger.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = { app, io };

