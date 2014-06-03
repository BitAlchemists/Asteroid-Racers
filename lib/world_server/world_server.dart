library world_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";

import "../shared/ar_shared.dart";

part "client_proxy.dart";
part "collision_detector.dart";
part "race_controller.dart";

Math.Random random = new Math.Random();

class WorldServer {
  final World _world = new World();
  CollisionDetector _crashCollisionDetector; 
  final Set<ClientProxy> _clients = new Set<ClientProxy>();
  RaceController _race;
  Entity _spawn;
  Map<Entity, ClientProxy> _entityToClientMap = new Map<Entity, ClientProxy>();

  World get world => _world;
  
  WorldServer(){
    List<Entity> asteroids = new List<Entity>();
    asteroids.addAll(_world.generateAsteroidBelt(1000, -4000, 250, 8000, 4000));
    _world.addEntities(asteroids);

    asteroids.addAll(_world.generateAsteroidBelt(20, -300, -100, 200, -1000));
    _world.addEntities(asteroids);

    asteroids.addAll(_world.generateAsteroidBelt(20, 100, -100, 200, -1000));
    _world.addEntities(asteroids);
    

    asteroids.addAll(_world.generateAsteroidBelt(20, -150, -1300, 300, -300));
    _world.addEntities(asteroids);
        
    //asteroids = _world.generateAsteroidBelt(1000, -4000, 250, 8000, 4000);
    //_world.addEntities(asteroids);

    _crashCollisionDetector = new CollisionDetector();
    _crashCollisionDetector.activeEntitiesCanCollide = true;
    _crashCollisionDetector.passiveEntitities = asteroids;
    
    _race = new RaceController();
/*
 *     _race.addCheckpoint(200.0, 0.0);
    _race.addCheckpoint(200.0, 300.0, 70.0);
    _race.addCheckpoint(400.0, 500.0, 50.0);
    _race.addCheckpoint(100.0, 600.0, 50.0);
    _race.addCheckpoint(200.0, 900.0, 100.0);*/
    _race.addStart(0.0, 0.0, Math.PI);
    _race.addCheckpoint(0.0, -500.0);
    _race.addCheckpoint(0.0, -1700.0);
        
    
    
    /*for(int i = 0; i < 5; i++){
      _race.addRandomCheckpoint(400.0, 50.0);      
    }
    _race.addRandomCheckpoint(400.0, 100.0);*/
    
        
    _world.addEntities(_race.checkpoints);
    _world.addEntity(_race.start);
    
    _spawn = new Entity(null);
    _spawn.position = new Vector2(-200.0, 0.0);
    _spawn.radius = 100.0;
    _spawn.orientation = Math.PI;
    
    /* Dummy player
    Entity dummyPlayer = new Entity(EntityType.SHIP, new Vector2(50.0, 50.0), 10.0);
    dummyPlayer.displayName = "Dummy";
    _world.addEntity(dummyPlayer);
    _collisionDetector.asteroids.add(dummyPlayer);
    */

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
    _race.update();
  }
  
  void _checkCollisions()
  {
    Map<Entity, List<Entity>> collidingEntities = _crashCollisionDetector.detectCollisions();
    
    for(Movable movable in collidingEntities.keys)
    {
      _crashCollisionDetector.activeEntities.remove(movable);
     movable.canMove = false;
      Message message = new Message(MessageType.COLLISION,movable.id);
      _sendToClients(message);
      new Future.delayed(new Duration(seconds:1), (){
        //if the entity still exists
        if(_world.entities.containsKey(movable.id)){
          ClientProxy client = _clientForEntity(movable);
          _spawnPlayer(client);
          Message message = new Message(MessageType.ENTITY,movable);
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
      _crashCollisionDetector.activeEntities.remove(client.playerEntity);
      _race.removePlayer(client);
      _entityToClientMap.remove(client.playerEntity);
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
    Movable player = new Movable();
    player.type = EntityType.SHIP;
    player.radius = 10.0;
    player.displayName = desiredUsername;
    player.canMove = true;    
    _world.addEntity(player);
    
    _entityToClientMap[player] = client;
    
    client.playerEntity = player;
    
    _race.addPlayer(client);

    _spawnPlayer(client);
    updatePlayerEntity(client, client.playerEntity);
    
    return player;
  }
  
  _spawnPlayer(ClientProxy client){
    
    Movable movable = client.playerEntity;
    
    if(client.race != null){
      Entity spawn = _race.spawnEntityForPlayer(client);
      movable.position = spawn.position;
      movable.orientation = spawn.orientation;
    }
    else {
      Vector2 randomPoint = randomPointInCircle();
      movable.position = _spawn.position + randomPoint * (_spawn.radius - movable.radius);
      movable.orientation = _spawn.orientation;      
    }
        
    
    movable.canMove = true;
    _crashCollisionDetector.activeEntities.add(movable);
    movable.velocity = new Vector2.zero();
    movable.acceleration = new Vector2.zero();
    movable.rotationSpeed = 0.0;    
  }
  
  Vector2 randomPointInCircle(){
    double x = random.nextDouble()*2 - 1;
    double y = random.nextDouble()*2 - 1;
    Vector2 point = new Vector2(x,y);
    if(point.length <= 1)
    {
      return point;
    }
    else
    {
      return randomPointInCircle();
    }
  }   
  
  void broadcastFromPlayer(ClientProxy sender, Message message) {
    _sendToClientsExcept(message, sender);
  }
  
  void updatePlayerEntity(ClientProxy client, Movable entity){
    Movable playerEntity = _world.entities[client.playerEntity.id];
    playerEntity.copyFrom(entity);
        
    Message message = new Message(MessageType.ENTITY, entity);
    _sendToClientsExcept(message, client);
  }
  
  ClientProxy _clientForEntity(Entity entity){
    return _entityToClientMap[entity];
  }
}
