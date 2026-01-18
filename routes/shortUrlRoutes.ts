import express from "express";
import {
    createShortUrl,
    resolveShortUrl,
    getShortUrlInfo,
} from "../controllers/shortUrlController";

const shortUrlRouter = express.Router();

/**
 * @openapi
 * '/api/short-urls':
 *  post:
 *     tags:
 *     - Short URL Controller
 *     summary: Create a short URL for a resource
 *     requestBody:
 *      required: true
 *      content:
 *        application/json:
 *           schema:
 *            type: object
 *            required:
 *              - originalUrl
 *              - resourceType
 *              - resourceId
 *            properties:
 *              originalUrl:
 *                type: string
 *                description: The full URL to shorten
 *                default: http://localhost:5173/challenge/abc123
 *              resourceType:
 *                type: string
 *                enum: [challenge, solution, team]
 *                description: Type of resource being shortened
 *              resourceId:
 *                type: string
 *                description: ID of the resource
 *     responses:
 *      201:
 *        description: Created
 *      200:
 *        description: Existing short URL returned
 *      400:
 *        description: Bad Request
 *      500:
 *        description: Server Error
 */
shortUrlRouter.post("/", createShortUrl);

/**
 * @openapi
 * '/api/short-urls/:code':
 *  get:
 *     tags:
 *     - Short URL Controller
 *     summary: Get short URL information without redirecting
 *     responses:
 *      200:
 *        description: Success
 *      400:
 *        description: Bad Request
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
shortUrlRouter.get("/:code", getShortUrlInfo);

export default shortUrlRouter;

// Separate router for the redirect endpoint
export const shortUrlResolveRouter = express.Router();

/**
 * @openapi
 * '/s/:code':
 *  get:
 *     tags:
 *     - Short URL Controller
 *     summary: Redirect to original URL
 *     responses:
 *      301:
 *        description: Redirect to original URL
 *      400:
 *        description: Bad Request
 *      404:
 *        description: Not Found
 *      500:
 *        description: Server Error
 */
shortUrlResolveRouter.get("/:code", resolveShortUrl);
