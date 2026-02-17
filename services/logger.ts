import winston from "winston";
import "winston-daily-rotate-file";

const { combine, timestamp, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// Determine log level based on environment
const getLogLevel = (): string => {
    const env = process.env.NODE_ENV || "development";
    switch (env) {
        case "production":
            return "warn";
        case "test":
            return "error";
        default:
            return "debug";
    }
};

// Create transports array based on environment
const createTransports = (): winston.transport[] => {
    const transports: winston.transport[] = [
        // Daily rotate file transport for errors
        new winston.transports.DailyRotateFile({
            filename: "logs/error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            level: "error",
            maxSize: "20m",
            maxFiles: "30d",
            zippedArchive: true,
            format: combine(timestamp(), json()),
        }),
        // Daily rotate file transport for all logs
        new winston.transports.DailyRotateFile({
            filename: "logs/combined-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxSize: "20m",
            maxFiles: "14d",
            zippedArchive: true,
            format: combine(timestamp(), json()),
        }),
    ];

    // Only add console transport in non-production environments
    if (process.env.NODE_ENV !== "production") {
        transports.push(
            new winston.transports.Console({
                format: combine(colorize(), timestamp({ format: "HH:mm:ss" }), consoleFormat),
            })
        );
    }

    return transports;
};

// Create and export the logger instance
const logger = winston.createLogger({
    level: getLogLevel(),
    format: combine(timestamp(), json()),
    transports: createTransports(),
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.DailyRotateFile({
            filename: "logs/exceptions-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxSize: "20m",
            maxFiles: "30d",
            zippedArchive: true,
        }),
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.DailyRotateFile({
            filename: "logs/rejections-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            maxSize: "20m",
            maxFiles: "30d",
            zippedArchive: true,
        }),
    ],
});

// Stream for Morgan HTTP logging integration (if needed)
export const httpLogStream = {
    write: (message: string) => {
        logger.http(message.trim());
    },
};

export default logger;


// Logger usage example
// import logger from "./services/logger";
// logger.info("This is an info message");
// logger.error("This is an error message");
// logger.warn("This is a warning message");
// logger.debug("This is a debug message");