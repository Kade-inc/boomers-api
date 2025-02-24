import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { createMessage, deleteMessage, getMessages, updateMessage } from "../controllers/messageController";

const messageRouter = express.Router();
messageRouter.use(validateToken);

messageRouter.post("/", createMessage);
messageRouter.get("/:chatId", getMessages);
messageRouter.put("/:messageId", updateMessage);
messageRouter.delete("/:messageId", deleteMessage);

export default messageRouter;
