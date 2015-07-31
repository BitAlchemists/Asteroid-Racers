library shared_server;

import "package:asteroidracers/shared/net/envelope.pb.dart";
import "package:asteroidracers/shared/world.dart";

typedef void MessageHandler(IClientProxy client, Envelope envelope);

abstract class IClientProxy {
  String get playerName;
  Movable movable;
  void send(Message message); //can we delete this? it implies knowledge about messaging
}

abstract class IGameServer {
  Set<IClientProxy> get clients; //TODO: can we delete this?
  World get world;

  void connectClient(IClientProxy client);
  void disconnectClient(IClientProxy client);
  void registerPlayer(IClientProxy client, String desiredUsername);
  void computePlayerInput(IClientProxy client, MovementInput input);
  
  broadcastMessage(Envelope envelope, {Set<IClientProxy> blacklist});
  sendMessageToClientsExcept(Envelope envelope, IClientProxy client);
}