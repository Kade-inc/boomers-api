import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import { createMessage, createMessageWithChat, deleteMessage, getMessages, updateMessage } from "../controllers/messageController";

const messageRouter = express.Router();
messageRouter.use(validateToken);

messageRouter.post("/", createMessage);
messageRouter.post("/with-chat", createMessageWithChat);
messageRouter.get("/:chatId", getMessages);
messageRouter.put("/:messageId", updateMessage);
messageRouter.delete("/:messageId", deleteMessage);

export default messageRouter;
