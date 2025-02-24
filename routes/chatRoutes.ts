import express from "express";

import validateToken from "../middleware/validateTokenHandler";
import {
  createChat,
  deleteChat,
  findChat,
  findChatByChatId,
  findUserChats,
  updateChat,
} from "../controllers/chatController";

const chatRouter = express.Router();
chatRouter.use(validateToken);

chatRouter.post("/", createChat);

// Example route: GET /chats/find?members=firstId,secondId,thirdId
chatRouter.get("/find", findChat);

chatRouter.get("/", findChatByChatId)

chatRouter.get("/:userId", findUserChats);

chatRouter.put("/:chatId", updateChat)

chatRouter.delete("/:chatId", deleteChat)


export default chatRouter;
