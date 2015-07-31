library chat_server;

import "package:asteroidracers/shared/shared_server.dart";
import "chat_shared.dart";

class ChatServer {
  
  IGameServer _gameServer;
  
  ChatServer(this._gameServer);

  /// We get a message from a client and broadcast it to all clients
  void onChatMessage(IClientProxy client, Envelope envelope)
  {
    //unpack the message, write the sender name in it and pack again
    ChatMessage chatMessage = new ChatMessage.fromBuffer(envelope.payload);
    chatMessage.from = client.playerName;
    envelope.payload = chatMessage.writeToBuffer();

    _gameServer.broadcastMessage(envelope);
  }
}