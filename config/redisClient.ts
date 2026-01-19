// config/redisClient.js
import { createClient } from "redis";

const redisClient = createClient({
  // You can add your Redis URL or configuration options here, e.g.,
  // url: process.env.REDIS_URL
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

(async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
})();

export default redisClient;
