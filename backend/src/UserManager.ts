import type { WebSocket } from "ws";
import type { OutgoingMessages } from "./messages/OutgoingMessages";

interface User {
  name: string;
  id: string;
  ws: WebSocket;
}

interface Room {
  users: User[];
}

export class UserManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map<string, Room>();
  }

  addUser(name: string, userId: string, roomId: string, ws: WebSocket) {
    if (!this.rooms.get(roomId)) {
      this.rooms.set(roomId, { users: [] });
    }
    this.rooms.get(roomId)?.users.push({ name, id: userId, ws });
  }

  removeUser(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.users = room.users.filter(({ id }) => id !== userId);
  }

  getUser(roomId: string, userId: string): User | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.users.find(({ id }) => id === userId) ?? null;
  }

  broadcast(roomId: string, senderId: string, message: OutgoingMessages) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.error("Room not found");
      return;
    }

    const msgStr = JSON.stringify(message);
    for (const user of room.users) {
      if (user.id !== senderId && user.ws.readyState === user.ws.OPEN) {
        user.ws.send(msgStr);
      }
    }
  }
}