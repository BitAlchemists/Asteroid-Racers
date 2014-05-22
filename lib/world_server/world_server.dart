library world_server;

import "package:vector_math/vector_math.dart";
import "../shared/ar_shared.dart";


part "client_proxy.dart";

class WorldServer {
  final World _world = new World();
  final List<ClientProxy> _clients = new List<ClientProxy>();

  World get world => _world;
  
  WorldServer(){
    _world.generateAsteroidBelt(500, 2000, 2000);  
    ClientProxy.worldServer = this;
  }
  
  void connectClient(ClientProxy client){
    print("player connected");
    _clients.add(client);
  }
  
  void disconnectClient(ClientProxy client){
    print("player disconnected");
    _clients.remove(client);
    if(client.playerEntity != null){
      _world.removeEntity(client.playerEntity);      
    }
  }  
  
  Entity registerPlayer(ClientProxy client){
     Entity player = new Entity(EntityType.SHIP, new Vector2.zero());
     _world.addEntity(player);
     return player;
  }
  
  void broadcastFromPlayer(ClientProxy sender, Message message) {
    for(ClientProxy client in _clients) {
      if(client != sender){
        client.send(message);
      }
    }
  }
  
  void updateEntity(Entity entity){
    for(ClientProxy client in _clients) {
      client.send(new Message(MessageType.ENTITY, entity));
    }
  }
}
