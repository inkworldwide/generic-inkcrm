import mongoose from 'mongoose';

let mongod: any = null;

export const connectDB = async (): Promise<void> => {
  try {
    let connUri = process.env.MONGODB_URI;
    mongoose.set('strictQuery', true);

    let isMemory = false;

    // Check if we should fall back to memory server
    if (!connUri || connUri.includes('127.0.0.1') || connUri.includes('localhost')) {
      try {
        // Attempt a quick connection to local server
        await mongoose.connect(connUri || 'mongodb://127.0.0.1:27017/inkcrm', { 
          serverSelectionTimeoutMS: 1500 
        });
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
        return;
      } catch (err) {
        console.log('Local MongoDB not detected on 27017. Spinning up in-memory MongoDB Server...');
        isMemory = true;
      }
    }

    if (isMemory) {
      // Dynamic import to prevent errors if package is loading
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      connUri = mongod.getUri();
    }

    if (!connUri) {
      throw new Error('No MongoDB URI available.');
    }

    await mongoose.connect(connUri);
    console.log(`MongoDB Connected: ${mongoose.connection.host} ${isMemory ? '(In-Memory Database)' : ''}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  } catch (error) {
    console.error('Error stopping in-memory database:', error);
  }
};
