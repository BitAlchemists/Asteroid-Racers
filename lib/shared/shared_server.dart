library shared_server;

import "package:asteroidracers/shared/net/envelope.pb.dart";
import "package:asteroidracers/shared/world.dart" as world;
//import "package:asteroidracers/shared/net.dart" as net;

typedef void MessageHandler(IClientProxy client, Envelope envelope);

abstract class IClientProxy {
  world.Movable movable;
  String get playerName;
  void send(Envelope envelope); //can we delete this? it implies knowledge about messaging
}

abstract class IGameServer {
  Set<IClientProxy> get clients; //TODO: can we delete this?
  world.World get world;

  void registerService(IServerService service);

  void connectClient(IClientProxy client);
  void disconnectClient(IClientProxy client);
  void registerPlayer(IClientProxy client, String desiredUsername);
  void computePlayerInput(IClientProxy client, world.MovementInput input);
  void teleportPlayerTo(IClientProxy client, world.Vector2 position, double orientation, bool informClientToo);
  
  broadcastMessage(Envelope envelope, {Set<IClientProxy> blacklist});
  sendMessageToClientsExcept(Envelope envelope, IClientProxy client);
}

abstract class IServerService {
  IGameServer server;

  void start();
  void preUpdate(double dt);
  void update(double dt);
  void postUpdate(double dt);
}