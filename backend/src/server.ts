import app from './app';
import { connectDB } from './config/db';
import Organization from './models/Organization';
import { seedDatabase } from './utils/seeder';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Auto-seed if database is empty
    const count = await Organization.countDocuments();
    if (count === 0) {
      console.log('No organization tenants detected. Running auto-seeder...');
      await seedDatabase(false);
      console.log('Auto-seeding completed.');
    }

    app.listen(PORT, () => {
      console.log(`=================================`);
      console.log(` inkCRM Backend API Server Running`);
      console.log(` Port: ${PORT}`);
      console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
      console.log(`=================================`);
    });
  } catch (error) {
    console.error('Fatal error starting the server:', error);
    process.exit(1);
  }
};

startServer();
