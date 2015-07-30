library shared_server;

import "package:asteroidracers/shared/shared.dart";

typedef void MessageHandler(IClientProxy client, Message message);

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

  broadcastMessage(Message message, {Set<IClientProxy> blacklist}); // can we delete this? it implies knowledge about messaging
  sendMessageToClientsExcept(Message message, IClientProxy client); // can we delete this? it implies knowledge about messaging
}