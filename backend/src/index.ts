import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { UserManager } from "./UserManager";
import { InMemoryStore } from "./store/InMemoryStore";
import {
  SupportedMessage,
  type IncomingMessage,
} from "./messages/IncomingMessages";
import {
  SupportedMessage as OutgoingSupportedMessages,
  type OutgoingMessages,
} from "./messages/OutgoingMessages";

const userManager = new UserManager();
const store = new InMemoryStore();

const server = http.createServer((req, res) => {
  console.log(`${new Date()} Received request for ${req.url}`);
  res.writeHead(404);
  res.end();
});

server.listen(8081, () => {
  console.log(`${new Date()} Server is listening on port 8081`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  console.log(`${new Date()} Connection accepted from ${req.socket.remoteAddress}`);

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as IncomingMessage;
      messageHandler(ws, message);
    } catch (e) {
      console.error("Failed to handle message:", e, data.toString());
    }
  });

  ws.on("close", () => {
    console.log(`${new Date()} Peer disconnected.`);
  });
});

function messageHandler(ws: import("ws").WebSocket, message: IncomingMessage) {
  if (message.type === SupportedMessage.JoinRoom) {
    const payload = message.payload;
    userManager.addUser(payload.name, payload.roomId, payload.userId, ws);
  }

  if (message.type === SupportedMessage.SendMessage) {
    const payload = message.payload;
    const user = userManager.getUser(payload.roomId, payload.userId);
    if (!user) {
      console.error("User not found in db");
      return;
    }

    const chat = store.addChat(payload.userId, user.name, payload.roomId, payload.message);
    if (!chat) return;

    const outgoingPayload: OutgoingMessages = {
      type: OutgoingSupportedMessages.AddChat,
      payload: {
        chatId: chat.id,
        roomId: payload.roomId,
        message: payload.message,
        name: user.name,
        upvotes: 0,
      },
    };

    userManager.broadcast(payload.roomId, payload.userId, outgoingPayload);
  }

  if (message.type === SupportedMessage.UpvoteMessage) {
    const payload = message.payload;
    const user = userManager.getUser(payload.roomId, payload.userId);
    if (!user) {
      console.error("User not found in db");
      return;
    }

    const chat = store.upvote(payload.userId, payload.roomId, payload.chatId);
    if (!chat) return;

    const outgoingPayload: OutgoingMessages = {
      type: OutgoingSupportedMessages.UpdateChat,
      payload: {
        chatId: payload.chatId,
        roomId: payload.roomId,
        upvotes: chat.upvotes.length,
      },
    };

    userManager.broadcast(payload.roomId, payload.userId, outgoingPayload);
  }
}
