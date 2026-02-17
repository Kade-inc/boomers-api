import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import ShortUrl, { generateShortCode } from "../models/shortUrlModel";
import logger from "../services/logger";

/**
 * @desc    Create a short URL for a resource
 * @route   POST /api/short-urls
 * @access  Public (can be made protected if needed)
 */
export const createShortUrl = asyncHandler(
    async (req: Request, res: Response) => {
        const { originalUrl, resourceType, resourceId } = req.body;

        // Validate required fields
        if (!originalUrl || !resourceType || !resourceId) {
            res.status(400);
            throw new Error("originalUrl, resourceType, and resourceId are required");
        }

        // Validate resourceType
        const validTypes = ["challenge", "solution", "team"];
        if (!validTypes.includes(resourceType)) {
            res.status(400);
            throw new Error("resourceType must be one of: challenge, solution, team");
        }

        // Check if short URL already exists for this resource
        const existingShortUrl = await ShortUrl.findOne({
            resourceType,
            resourceId,
        });

        if (existingShortUrl) {
            // Return existing short URL
            const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;
            res.status(200).json({
                shortUrl: `${baseUrl}/s/${existingShortUrl.code}`,
                code: existingShortUrl.code,
                isExisting: true,
            });
            return;
        }

        // Generate unique short code
        let code: string;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            code = generateShortCode();
            const existing = await ShortUrl.findOne({ code });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            res.status(500);
            throw new Error("Failed to generate unique short code");
        }

        // Get user ID if authenticated (optional)
        const userId = (req as any).user?.id;

        // Create short URL
        const shortUrl = await ShortUrl.create({
            code: code!,
            originalUrl,
            resourceType,
            resourceId,
            createdBy: userId,
            clickCount: 0,
        });

        const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5001}`;

        logger.info(`Short URL created: ${shortUrl.code} for ${resourceType}:${resourceId}`);
        res.status(201).json({
            shortUrl: `${baseUrl}/s/${shortUrl.code}`,
            code: shortUrl.code,
            isExisting: false,
        });
    }
);

/**
 * @desc    Resolve a short URL and redirect to original
 * @route   GET /s/:code
 * @access  Public
 */
export const resolveShortUrl = asyncHandler(
    async (req: Request, res: Response) => {
        const { code } = req.params;

        if (!code) {
            res.status(400);
            throw new Error("Short code is required");
        }

        const shortUrl = await ShortUrl.findOne({ code });

        if (!shortUrl) {
            res.status(404);
            throw new Error("Short URL not found");
        }

        // Increment click count (non-blocking)
        ShortUrl.findByIdAndUpdate(shortUrl._id, {
            $inc: { clickCount: 1 },
        }).exec();

        // Redirect to original URL
        logger.info(`Redirecting short URL code: ${code} to ${shortUrl.originalUrl}`);
        res.redirect(301, shortUrl.originalUrl);
    }
);

/**
 * @desc    Get short URL info (without redirecting)
 * @route   GET /api/short-urls/:code
 * @access  Public
 */
export const getShortUrlInfo = asyncHandler(
    async (req: Request, res: Response) => {
        const { code } = req.params;

        if (!code) {
            res.status(400);
            throw new Error("Short code is required");
        }

        const shortUrl = await ShortUrl.findOne({ code });

        if (!shortUrl) {
            res.status(404);
            throw new Error("Short URL not found");
        }

        logger.info(`Fetched info for short URL code: ${code}`);
        res.status(200).json({
            code: shortUrl.code,
            originalUrl: shortUrl.originalUrl,
            resourceType: shortUrl.resourceType,
            resourceId: shortUrl.resourceId,
            clickCount: shortUrl.clickCount,
            createdAt: shortUrl.createdAt,
        });
    }
);
