import dotenv from 'dotenv';
dotenv.config({ override: true });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import morgan from 'morgan';
import compression from 'compression';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import bikeRoutes from './routes/bikes.js';
import rentalRoutes from './routes/rentals.js';
import userRoutes from './routes/users.js';
import documentRoutes from './routes/documents.js';
import locationRoutes from './routes/locations.js';
import paymentRoutes from './routes/payments.js';
import settingsRoutes from './routes/settings.js';
import heroImageRoutes from './routes/heroImages.js';
import supportRoutes from './routes/support.js';
import { initCronJobs } from './utils/cron.js';

const app = express();

// =====================================
// ✅ LOGGER (Winston)
// =====================================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

// =====================================
// ✅ PERFORMANCE & UTILITY MIDDLEWARE
// =====================================
app.use(compression()); // Compress all responses
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')); // HTTP request logger

// =====================================
// ✅ IMPORTANT FOR RENDER / DEPLOYMENT
// =====================================
const PORT = process.env.PORT || 9000;

// =====================================
// ✅ SECURITY MIDDLEWARE
// =====================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable if you're serving a frontend separately or use proper config
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // increased for production
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
// app.use('/api/', limiter); // Apply only to API routes

// =====================================
// ✅ CORS CONFIGURATION
// =====================================
// const allowedOrigins = process.env.ALLOWED_ORIGINS 
//   ? process.env.ALLOWED_ORIGINS.split(',') 
//   : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080'];

app.use(cors({
  origin: true, // Allow all origins for testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// =====================================
// ✅ MIDDLEWARE
// =====================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================
// ✅ STATIC ASSETS (Optional)
// =====================================
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/uploads', express.static('uploads'));

// =====================================
// ✅ ROUTES
// =====================================
app.use('/api/auth', authRoutes);
app.use('/api/bikes', bikeRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/hero-images', heroImageRoutes);
app.use('/api/support', supportRoutes);

// =====================================
// ✅ HEALTH CHECK
// =====================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// =====================================
// ✅ ROOT ROUTE
// =====================================
app.get('/', (req, res) => {
  res.send('Bike Rental API is running. Documentation: /api/docs');
});

// =====================================
// ✅ 404 HANDLER
// =====================================
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});

// =====================================
// ✅ GLOBAL ERROR HANDLER
// =====================================
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  logger.error(`${err.name}: ${err.message}`, { 
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    path: req.originalUrl,
    method: req.method
  });
  
  res.status(statusCode).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message
  });
});
// =====================================
// ✅ START SERVER (FIXED)
// =====================================
const startServer = async () => {
  try {
    await connectDB(); // ✅ ONLY here

    initCronJobs(); // ✅ after DB

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      logger.info(`🚀 Server running on port ${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please stop the process using this port and try again.`);
        logger.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error.message);
        logger.error('❌ Server error:', error.message);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();