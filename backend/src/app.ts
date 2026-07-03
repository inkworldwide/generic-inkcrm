import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { resolveTenant } from './middleware/tenantMiddleware';

// Import routers
import authRoutes from './routes/authRoutes';
import tenantRoutes from './routes/tenantRoutes';
import moduleRoutes from './routes/moduleRoutes';
import recordRoutes from './routes/recordRoutes';
import workflowRoutes from './routes/workflowRoutes';
import reportRoutes from './routes/reportRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import documentRoutes from './routes/documentRoutes';
import auditRoutes from './routes/auditRoutes';
import statusRoutes from './routes/statusRoutes';

const app = express();

// Security and CORS configurations
app.use(helmet({
  crossOriginResourcePolicy: false // Allows loading local static files
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('localhost:5173')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Multi-tenant resolver middleware runs on all API routes
app.use(resolveTenant);

// Mount API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tenants', tenantRoutes);
app.use('/api/v1/modules', moduleRoutes);
app.use('/api/v1/records', recordRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/statuses', statusRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to inkCRM API Server' });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong on the server!' });
});

export default app;
