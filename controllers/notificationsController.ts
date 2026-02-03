import asyncHandler from "express-async-handler";
import Notification from "../models/notificationModel";
import { CustomRequest } from "../middleware/validateTokenHandler";
import sseNotificationService from "../services/sseService";

// PATCH /api/notifications/:id
export const updateNotificationStatus = asyncHandler(async (req: CustomRequest, res) => {
    const { id } = req.params;
    const { isRead } = req.body; // expects a boolean value

    if (typeof isRead !== "boolean") {
        res.status(400);
        throw new Error("The 'isRead' field must be a boolean value.");
    }

    try {
        const notification = await Notification.findById(id);

        if (!notification) {
            res.status(404);
            throw new Error("Notification not found");
        }

        if (req.user.id !== notification.user.toString()) {
            res.status(403).json({ 'error': "unauthorizaed" })
            return
        }

        notification.isRead = isRead;
        await notification.save();

        res.status(200).json({ message: "Notification status updated", data: notification });
    } catch (error: any) {
        res.status(500)
        throw new (error)
    }
});


// GET /api/notifications
export const getUserNotifications = asyncHandler(async (req: CustomRequest, res) => {
    try {
        // Assuming req.user is populated by your authentication middleware
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 }); // Optional: sort notifications by newest first

        res.status(200).json({
            message: "Notifications fetched successfully",
            data: notifications,
        });
    } catch (error: any) {
        res.status(500)
        throw new (error)
    }
});


// GET /api/notifications/:id
export const getNotificationById = asyncHandler(async (req: CustomRequest, res) => {
    const { id } = req.params;

    try {
        // Retrieve the notification by its ID
        const notification = await Notification.findById(id);

        if (!notification) {
            res.status(404);
            throw new Error("Notification not found");
        }

        // Ensure the notification belongs to the authenticated user
        if (notification.user.toString() !== req.user.id) {
            res.status(403);
            throw new Error("Not authorized to access this notification");
        }

        res.status(200).json({
            message: "Notification fetched successfully",
            data: notification,
        });
    } catch (error: any) {
        res.status(500)
        throw new (error)
    }
});


// PATCH /api/notifications/read-all
export const markAllNotificationsAsRead = asyncHandler(async (req: CustomRequest, res) => {
    // Assumes req.user is populated by authentication middleware
    const userId = req.user.id;

    try {
        // Update all unread notifications for this user to isRead: true
        const result = await Notification.updateMany(
            { user: userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            message: "All notifications marked as read",
            data: result,
        });
    } catch (error: any) {
        res.status(500)
        throw new (error)
    }
});


// GET /api/notifications/stream - SSE endpoint for real-time notifications
export const sseStream = asyncHandler(async (req: CustomRequest, res) => {
    const userId = req.user.id;

    // Add this client to the SSE service
    const clientId = sseNotificationService.addClient(userId, res);

    // Handle client disconnect
    req.on('close', () => {
        sseNotificationService.removeClient(userId, clientId);
    });

    // Keep the connection open - the response will be handled by SSE service
    // Don't call res.end() or res.json() as this is a long-lived connection
});