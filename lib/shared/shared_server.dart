library shared_server;

import "package:asteroidracers/shared/net/envelope.pb.dart";
import "package:asteroidracers/shared/world.dart";

typedef void MessageHandler(IClientProxy client, Envelope envelope);

abstract class IClientProxy {
  String get playerName;
  Movable movable;
}

abstract class IGameServer {
  Set<IClientProxy> get clients;
  
  broadcastMessage(Envelope envelope, {Set<IClientProxy> blacklist});
  sendMessageToClientsExcept(Envelope envelope, IClientProxy client);
}