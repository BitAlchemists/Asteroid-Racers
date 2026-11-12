import { createEnvelope, MessageType } from "@ar/shared";
import type { IGameServer, IServerService } from "./contracts";

export const MAX_CHAT_LENGTH = 500;

/** Relays chat messages to everyone, stamped with the sender's ship name. */
export class ChatServer implements IServerService {
  attach(server: IGameServer): void {
    server.dispatcher.on(MessageType.CHAT, (message, client) => {
      const text = message.text.slice(0, MAX_CHAT_LENGTH);
      if (!client.playerName || text.trim() === "") return;
      server.broadcastMessage(createEnvelope(MessageType.CHAT, { from: client.playerName, text }));
    });
  }
}
