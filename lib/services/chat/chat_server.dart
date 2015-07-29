library chat_server;

import "package:asteroidracers/shared/shared.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "chat_shared.dart";

class ChatServer {
  
  IGameServer _gameServer;
  
  ChatServer(this._gameServer);

  /// We get a message from a client and broadcast it to all clients
  void onChatMessage(IClientProxy client, Message message)
  {
    //unpack the message, write the sender name in it and pack again
    ChatMessage chatMessage = new ChatMessage.fromBuffer(message.payload);
    chatMessage.from = client.playerName;
    message.payload = chatMessage.writeToBuffer();

    _gameServer.broadcastMessage(message);
  }
}