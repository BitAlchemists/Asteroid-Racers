library chat_server;

import "package:asteroidracers/shared/shared.dart";
import "package:asteroidracers/shared/shared_server.dart";


class ChatServer {
  
  IGameServer _gameServer;
  
  ChatServer(this._gameServer);
  
  void onChatMessage(IClientProxy client, Message message)
  {
    message.payload["from"] = client.playerName;
    _gameServer.broadcastMessage(message);
  }
}