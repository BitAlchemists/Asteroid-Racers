library shared_client;

import "package:asteroidracers/shared/world.dart";

abstract class IGameClient {
  void updateEntity(Entity entity);
  void createPlayer(Entity entity);
  void handleCollision(int entityId);
  void removeEntity(int entityId);
  void joinRace(int entityId);
  void activateNextCheckpoint(int entityId);
  void leaveRace();
}