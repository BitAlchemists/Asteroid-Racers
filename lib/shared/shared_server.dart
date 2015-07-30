library shared_server;

import "package:asteroidracers/shared/shared.dart";

typedef void MessageHandler(IClientProxy client, Message message);

abstract class IClientProxy {
  String get playerName;
  Movable movable;
  void send(Message message);
}

abstract class IGameServer {
  Set<IClientProxy> get clients;
  
  broadcastMessage(Message message, {Set<IClientProxy> blacklist});
  sendMessageToClientsExcept(Message message, IClientProxy client);
}