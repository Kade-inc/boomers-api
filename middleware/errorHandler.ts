import { Request, Response } from "express";
import { constants } from "../constants";
import winston from "winston";
import "winston-daily-rotate-file";

// Configure Winston logger
const logger = winston.createLogger({
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Daily rotate file transport
    new winston.transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m", // Rotate when file reaches 20MB
      maxFiles: "30d", // Keep logs for 30 days
      zippedArchive: true, // Compress rotated files
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: any
) => {
  const statusCode = res.statusCode ? res.statusCode : 500;
  
  // Log error with additional context
  logger.error({
    message: err.message,
    stack: err.stack,
    statusCode,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    user: req.user, // If you have user info in the request
  });

  switch (statusCode) {
    case constants.VALIDATION_ERROR:
      res.json({
        title: "Validation Failed",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    case constants.CONFLICT:
      res.json({
        title: "Conflict",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    case constants.NOT_FOUND:
      res.json({
        title: "Not Found",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    case constants.UNAUTHORIZED:
      res.json({
        title: "Unauthorized",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    case constants.FORBIDDEN:
      res.json({
        title: "Validation failed",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    case constants.SERVER_ERROR:
      res.json({
        title: "Server Error",
        message: err.message,
        stackTrace: process.env.NODE_ENV === "development" ? err.stack : undefined,
      });
      break;
    default:
      logger.error("Unhandled error:", err);
      break;
  }
};
