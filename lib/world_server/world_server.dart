library world_server;

import "dart:math" as Math;

import "package:vector_math/vector_math.dart";
import "../shared/ar_shared.dart";


part "client_proxy.dart";

class WorldServer {
  final World _world = new World();
  final Set<ClientProxy> _clients = new Set<ClientProxy>();

  World get world => _world;
  
  WorldServer(){
    _world.generateAsteroidBelt(500, 2000, 2000);  
  }
  
  void connectClient(ClientProxy client){
    print("player connected");
    _clients.add(client);
    print("connected clients: ${_clients.length}");
  }
  
  void disconnectClient(ClientProxy client){
    
    if(client.playerEntity != null && client.playerEntity.displayName != null)
    {
      print("player ${client.playerEntity.displayName} disconnected");      
    }
    else
    {
      print("client disconnected before handshake");
    }
    
    _clients.remove(client);
    print("connected clients: ${_clients.length}");
    
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
    print("connected clients: ${_clients.length}");
    Set<ClientProxy> recipients = new Set<ClientProxy>.from(_clients);    
    print("${recipients.length} possible recipients. applying blacklist.");
    
    if(blacklist != null){
      recipients = recipients.difference(blacklist);      
    }
    
    print("sending message to ${recipients.length} recipients");
    
    for(ClientProxy client in recipients) {
      client.send(message);
    }
  }
  
  Entity registerPlayer(ClientProxy client, String desiredUsername){
    print("player identifies as $desiredUsername");    
    Entity player = new Entity(EntityType.SHIP, new Vector2.zero());
    player.displayName = desiredUsername;
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
