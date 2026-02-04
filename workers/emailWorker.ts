import { Worker, Job } from "bullmq";
import nodemailer from "nodemailer";
import { redisConnection } from "../config/redis";
import { EmailJobData } from "../services/emailQueue";
import dotenv from "dotenv";
import logger from "../services/logger";

dotenv.config();

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.MAIL_PASSWORD,
    },
});

// Create the email worker
const emailWorker = new Worker<EmailJobData>(
    "email",
    async (job: Job<EmailJobData>) => {
        const { to, template, subject } = job.data;

        logger.info(`[EmailWorker] Processing job ${job.id} - sending to: ${to}`);

        const mailOptions = {
            from: {
                name: "Boomers",
                address: process.env.USER_EMAIL as string,
            },
            to: [to],
            subject: subject,
            html: template,
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`[EmailWorker] Job ${job.id} completed - email sent to: ${to}`);
        } catch (error) {
            logger.error(`[EmailWorker] Job ${job.id} failed:`, { error });
            throw error; // Rethrow to trigger retry
        }
    },
    {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 emails concurrently
    }
);

// Worker event handlers
emailWorker.on("completed", (job) => {
    logger.info(`[EmailWorker] Job ${job.id} has completed successfully`);
});

emailWorker.on("failed", (job, err) => {
    logger.error(`[EmailWorker] Job ${job?.id} failed with error:`, { message: err.message });
});

emailWorker.on("error", (err) => {
    logger.error("[EmailWorker] Worker error:", { err });
});

logger.info("[EmailWorker] Email worker started and listening for jobs...");

export default emailWorker;
