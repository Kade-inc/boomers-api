import express from "express";
import validateToken from "../middleware/validateTokenHandler";
import { getNotificationById, getUserNotifications, markAllNotificationsAsRead, updateNotificationStatus } from "../controllers/notificationsController";

const notificationRouter = express.Router();
notificationRouter.use(validateToken);

notificationRouter.get("/", getUserNotifications)
notificationRouter.patch("/read-all", markAllNotificationsAsRead)
notificationRouter.get("/:id", getNotificationById)
notificationRouter.patch("/:id", updateNotificationStatus);


export default notificationRouter;