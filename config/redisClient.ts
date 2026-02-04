// config/redisClient.ts
import { createClient } from "redis";
import dotenv from "dotenv";
import logger from "../services/logger";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = createClient({
  url: redisUrl,
});

redisClient.on("error", (err) => logger.error("Redis Client Error", { err }));

(async () => {
  await redisClient.connect();
  logger.info("Connected to Redis");
})();

export default redisClient;
