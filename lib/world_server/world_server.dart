library world_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";

import "../shared/ar_shared.dart";

part "client_proxy.dart";
part "collision_detector.dart";

Math.Random random = new Math.Random();

class WorldServer {
  final World _world = new World();
  CollisionDetector _collisionDetector;
  final Set<ClientProxy> _clients = new Set<ClientProxy>();

  World get world => _world;
  
  WorldServer(){
    List<Entity> asteroids = _world.generateAsteroidBelt(1000, -1000, 100, 8000, 4000);
    _world.addEntities(asteroids);
    
    _collisionDetector = new CollisionDetector();
    _collisionDetector.asteroids = asteroids;
    
    /* Dummy player
    Entity dummyPlayer = new Entity(EntityType.SHIP, new Vector2(50.0, 50.0), 10.0);
    dummyPlayer.displayName = "Dummy";
    _world.addEntity(dummyPlayer);
    _collisionDetector.asteroids.add(dummyPlayer);
    */
    
    Entity checkpoint = new Entity(EntityType.CHECKPOINT, new Vector2(50.0, 50.0), 10.0);
    checkpoint.displayName = "Dummy";
    _world.addEntity(checkpoint);
    _collisionDetector.asteroids.add(checkpoint);
  }
  
  start(){
      // Construct a game loop.
      GameLoop gameLoop = new GameLoopIsolate();
      gameLoop.onUpdate = (_onHeartBeat);
      gameLoop.start();
  }
  
  //Heart Beat
  
  _onHeartBeat(GameLoop gameLoop){
    //print('${gameLoop.frame}: ${gameLoop.gameTime} [dt = ${gameLoop.dt}].');
    _checkCollisions();
  }
  
  void _checkCollisions()
  {
    Iterable<Entity> collidingEntities = _collisionDetector.detectCollisions();
    
    for(Entity entity in collidingEntities)
    {
      _collisionDetector.players.remove(entity);
      entity.canMove = false;
      Message message = new Message(MessageType.COLLISION, entity.id);
      _sendToClients(message);
      new Future.delayed(new Duration(seconds:1), (){
        //if the entity still exists
        if(_world.entities.containsKey(entity.id)){
          entity.canMove = true;
          _collisionDetector.players.add(entity);
          entity.position = new Vector2.zero();
          entity.velocity = new Vector2.zero();
          entity.acceleration = new Vector2.zero();
          entity.orientation = 0.0;
          entity.rotationSpeed = 0.0;
          Message message = new Message(MessageType.ENTITY, entity);
          _sendToClients(message);          
        }
      });
    }
  }
  
  //Client-Server communication
  
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
      _collisionDetector.players.remove(client.playerEntity);
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
  
  Entity registerPlayer(ClientProxy client, String desiredUsername){
    print("player identifies as $desiredUsername");    
    Entity player = new Entity(EntityType.SHIP, new Vector2.zero(), 10.0);
    player.displayName = desiredUsername;
    player.canMove = true;
    _world.addEntity(player);
    _collisionDetector.players.add(player);
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
