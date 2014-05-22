library world_server;

import "package:vector_math/vector_math.dart";
import "../shared/ar_shared.dart";


part "client_proxy.dart";

class WorldServer {
  final World _world = new World();
  final Set<ClientProxy> _clients = new Set<ClientProxy>();

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
    
    Message message = new Message(MessageType.ENTITY_REMOVE, client.playerEntity.id);
    _sendToClientsExcept(message, client);
  }  
  
  _sendToClientsExcept(Message message, ClientProxy client){
    _sendToClients(message, blacklist:new Set()..add(client));
  }
  
  _sendToClients(Message message, {Set<ClientProxy> blacklist}) {
    Set<ClientProxy> recipients = _clients;
    
    if(blacklist != null){
      recipients = recipients.difference(blacklist);      
    }
    
    for(ClientProxy client in recipients) {
      client.send(message);
    }
  }
  
  Entity registerPlayer(ClientProxy client){
     Entity player = new Entity(EntityType.SHIP, new Vector2.zero());
     _world.addEntity(player);
     return player;
  }
  
  void broadcastFromPlayer(ClientProxy sender, Message message) {
    _sendToClientsExcept(message, sender);
  }
  
  void updatePlayerEntity(ClientProxy client, Entity entity){
    Entity playerEntity = _world.entities[client.playerEntity.id];
    playerEntity.copyFrom(entity);
    
    Message message = new Message(MessageType.ENTITY, entity);
    _sendToClientsExcept(message, client);
  }
}
