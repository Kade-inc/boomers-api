import mongoose from "mongoose";
import dotenv from "dotenv";
import "../models"; // Import all models to ensure they are registered
import logger from "../services/logger";

dotenv.config();

// DECLARE ALL VARIABLES
const MONGO_DB_USER = process.env.MONGO_DB_USER || "";
const MONGO_DB_PASSWORD = process.env.MONGO_DB_PASSWORD || "";
const NODE_ENV = process.env.NODE_ENV || "";
const MONGO_URL = `mongodb+srv://${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@boomers-cluster.91kinv9.mongodb.net`;
const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 5001;
const MONGO_URL_LOCAL = `mongodb+srv://${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@boomers-cluster.91kinv9.mongodb.net`;

//CREATE CONFIG OBJECT
const config = {
  mongo: {
    url: MONGO_URL,
  },
  server: {
    port: SERVER_PORT,
  },
};

//CHECK FOR ENVIRONMENT
if (NODE_ENV === "production") {
  config.mongo.url = MONGO_URL;
  config.server.port = SERVER_PORT;
} else if (NODE_ENV === "local") {
  config.mongo.url = MONGO_URL_LOCAL;
  config.server.port = SERVER_PORT;
}

const connectDb = async () => {
  try {
    const connect = await mongoose.connect(config.mongo.url, {
      serverSelectionTimeoutMS: 80000,
      socketTimeoutMS: 0,
      connectTimeoutMS: 0
    });
    logger.info(
      "Database connected: ",
      { host: connect.connection.host, name: connect.connection.name }
    );
  } catch (err) {
    logger.error("Database connection failed", { err });
    process.exit(1);
  }
};

export default connectDb;
