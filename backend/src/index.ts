import { connection, server as WebSocketServer } from 'websocket'
import http from 'http'
import { UserManager } from './UserManager';
import { SupportedMessage, type IncomingMessage } from './messages/IncomingMessages';
import { SupportedMessage as OutgoingSupportedMessages, type OutgoingMessages } from "./messages/OutgoingMessages"
import { InMemoryStore } from './store/InMemoryStore';

const userManager = new UserManager()
const store = new InMemoryStore()

const server = http.createServer(function (request: any, response: any) {
   console.log((new Date()) + ' Received request for ' + request.url);
   response.writeHead(404);
   response.end();
});
server.listen(8081, function () {
   console.log((new Date()) + ' Server is listening on port 8081');
});

const wsServer = new WebSocketServer({
   httpServer: server,
   // autoAcceptConnections: true
});

function originIsAllowed(origin: string) {
   return true;
}

wsServer.on('request', function (request) {
   if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
   }

   const connection = request.accept(null, request.origin);
   console.log((new Date()) + ' Connection accepted.');
   connection.on('message', function (message) {
      // TODO: to add rate limiting logic
      if (message.type === 'utf8') {

         try {
            messageHandler(connection, JSON.parse(message.utf8Data))
         } catch (e) {
             console.error('Failed to handle message:', e, message.utf8Data)
         }

         // console.log('Received Message: ' + message.utf8Data);
         // connection.sendUTF(message.utf8Data);
      }
   });
   connection.on('close', function (reasonCode, description) {
      console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
   });
});

function messageHandler(ws: connection, message: IncomingMessage) {
   if (message.type === SupportedMessage.JoinRoom) {
      const payload = message.payload
      userManager.addUser(payload.name, payload.roomId, payload.userId, ws)
   }

   if (message.type === SupportedMessage.SendMessage) {
      const payload = message.payload
      const user = userManager.getUser(payload.roomId, payload.userId)
      if (!user) {
         console.error("User not found in db")
         return;
      }
      let chat = store.addChat(payload.userId, user.name, payload.roomId, payload.message)
      if (!chat) return
      const outgoingPayload: OutgoingMessages = {
         type: OutgoingSupportedMessages.AddChat,
         payload: {
            chatId: chat.id,
            roomId: payload.roomId,
            message: payload.message,
            name: user.name,
            upvotes: 0
         }
      }
      userManager.broadcast(payload.roomId, payload.userId, outgoingPayload)
   }

   if (message.type === SupportedMessage.UpvoteMessage) {
      const payload = message.payload;
      const user = userManager.getUser(payload.roomId, payload.userId)
      if (!user) {
         console.error("User not found in db")
         return;
      }
      const chat = store.upvote(payload.userId, payload.roomId, payload.chatId)
      
      if (!chat) {
         return
      }

      const outgoingPayload: OutgoingMessages = {
         type: OutgoingSupportedMessages.UpdateChat,
         payload: {
            chatId: payload.chatId,
            roomId: payload.roomId,
            upvotes: chat.upvotes.length
         }
      }
      userManager.broadcast(payload.roomId, payload.userId, outgoingPayload)
   }
}