library game_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";

import "package:asteroidracers/shared/shared.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/chat/chat_server.dart";

part "client_proxy.dart";
part "collision_detector.dart";
part "race_controller.dart";

Math.Random random = new Math.Random();

class GameServer implements IGameServer {
  final Set<IClientProxy> _clients = new Set<IClientProxy>();
  final World _world = new World();
  CollisionDetector _crashCollisionDetector;
  CollisionDetector _joinRaceCollisionDetector;
  RaceController _race;
  Entity _spawn;
  Map<Entity, ClientProxy> _entityToClientMap = new Map<Entity, ClientProxy>();
  ChatServer _chat;

  World get world => _world;
  
  // IGameServer
  Set<IClientProxy> get clients => _clients;
  
  GameServer(){
    _createWorld();
    _registerServices();
  }
  
  _createWorld(){
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
    _crashCollisionDetector.passiveEntities = asteroids;
    
    
    _race = new RaceController();
    _race.gameServer = this;
/*
 *     _race.addCheckpoint(200.0, 0.0);
    _race.addCheckpoint(200.0, 300.0, 70.0);
    _race.addCheckpoint(400.0, 500.0, 50.0);
    _race.addCheckpoint(100.0, 600.0, 50.0);
    _race.addCheckpoint(200.0, 900.0, 100.0);*/
    _race.addStart(0.0, -200.0, Math.PI);
    _race.addCheckpoint(0.0, -600.0);
    //_race.addCheckpoint(0.0, -1700.0);
    _race.addFinish(0.0, -800.0);

    _world.addEntities(_race.checkpoints);
    _world.addEntity(_race.start);
    _world.addEntity(_race.finish);
    
    _joinRaceCollisionDetector = new CollisionDetector();
    _joinRaceCollisionDetector.passiveEntities = [_race.start];

    _addArrows({num x: 0.0, num y: 0.0, double orientation: 0.0}){
      Entity arrows = new Entity(EntityType.ARROWS);
      arrows.position = new Vector2(x.toDouble(), y.toDouble());
      arrows.orientation = orientation;
      arrows.radius = 100.0;
      _world.addEntity(arrows);
    }
        
    _addArrows(y: -400, orientation: Math.PI);
    /*_addArrows(y: -200, orientation: Math.PI);    
    _addArrows(x: 100, y: -1200, orientation: Math.PI * 1.25);    
    _addArrows(x: -100, y: -1200, orientation: Math.PI * 0.75);    
    _addArrows(x: 150, y: -1700, orientation: Math.PI * 0.5);    
    _addArrows(x: -150, y: -1700, orientation: Math.PI * 1.5);        
    */        
    _spawn = new Entity(null);
    _spawn.position = new Vector2(0.0, 100.0);
    _spawn.radius = 100.0;
    _spawn.orientation = Math.PI;
    
    /* Dummy player
    Entity dummyPlayer = new Entity(EntityType.SHIP, new Vector2(50.0, 50.0), 10.0);
    dummyPlayer.displayName = "Dummy";
    _world.addEntity(dummyPlayer);
    _collisionDetector.asteroids.add(dummyPlayer);
    */
  }
  
  _registerServices(){
    
    _chat = new ChatServer(this);
    ClientProxy.registerMessageHandler(MessageType.CHAT, _chat.onChatMessage);
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
    _crashCollisionDetector.detectCollisions(_onPlayerCollision);
    _joinRaceCollisionDetector.detectCollisions(_onPlayerTouchRacePortal);
  }
  
  _onPlayerCollision(Movable playerEntity, Entity otherEntity){
    _crashCollisionDetector.activeEntities.remove(playerEntity);
    playerEntity.canMove = false;
    Message message = new Message(MessageType.COLLISION, playerEntity.id);
    broadcastMessage(message);
    new Future.delayed(new Duration(seconds:1), (){
      //if the entity still exists
      if(_world.entities.containsKey(playerEntity.id)){
        ClientProxy client = _clientForEntity(playerEntity);
        spawnPlayer(client, true);
        Message message = new Message(MessageType.ENTITY, playerEntity);
        broadcastMessage(message);          
      }
    });
  }
  
  _onPlayerTouchRacePortal(Movable playerEntity, RacePortal portal){
    var player = _clientForEntity(playerEntity);
    _joinRaceCollisionDetector.activeEntities.remove(playerEntity);
    portal.raceController.addPlayer(player);
  }
  
  //Client-Server communication
  
  void connectClient(ClientProxy client){
    print("player connected");
    _clients.add(client);
    
    Message welcomeMessage = new Message();
    welcomeMessage.messageType = MessageType.CHAT;
    welcomeMessage.payload = {"from": "Server", "message": "Welcome to the 'Apollo 13' development server."};
    client.send(welcomeMessage);
    
    print("connected clients: ${_clients.length}");
  }
  
  void disconnectClient(ClientProxy client){
    
    if(client.movable != null && client.movable.displayName != null)
    {
      print("player ${client.movable.displayName} disconnected");      
    }
    else
    {
      print("client disconnected before handshake");
    }
    
    _clients.remove(client);
    print("connected clients: ${_clients.length}");
    
    if(client.movable != null){
      _world.removeEntity(client.movable);
      _crashCollisionDetector.activeEntities.remove(client.movable);
      _race.removePlayer(client);
      _entityToClientMap.remove(client.movable);
    }
    
    Message message = new Message(MessageType.ENTITY_REMOVE, client.movable.id);
    sendMessageToClientsExcept(message, client);
  }
  
  sendMessageToClientsExcept(Message message, ClientProxy client){
    broadcastMessage(message, blacklist:new Set()..add(client));
  }
  
  broadcastMessage(Message message, {Set<IClientProxy> blacklist}) {
    Set<IClientProxy> recipients = _clients;    
    
    if(blacklist != null){
      recipients = recipients.difference(blacklist);      
    }
    
    
    for(ClientProxy client in recipients) {
      client.send(message);
    }
  }
  
  void registerPlayer(ClientProxy client, String desiredUsername){
    print("player identifies as $desiredUsername");    
    Movable player = new Movable();
    player.type = EntityType.SHIP;
    player.radius = 20.0;
    player.displayName = desiredUsername;
    _world.addEntity(player);
    
    _entityToClientMap[player] = client;
    
    client.movable = player;
    
    _joinRaceCollisionDetector.activeEntities.add(client.movable);
        
    spawnPlayer(client, false);
  }
  
  spawnPlayer(ClientProxy client, bool informClientToo){
    
    Movable movable = client.movable;
    Vector2 position;
    double orientation;
    
    if(client.race != null){
      Entity spawn = _race.spawnEntityForPlayer(client);
      position = spawn.position;
      orientation = spawn.orientation;
    }
    else {
      Vector2 randomPoint = randomPointInCircle();
      position = _spawn.position + randomPoint * (_spawn.radius - movable.radius);
      orientation = _spawn.orientation;      
    }
            
    if(!_crashCollisionDetector.activeEntities.contains(movable)){
      _crashCollisionDetector.activeEntities.add(movable);      
    }
    
    teleportPlayerTo(client, position, orientation, false);
  }
  
  teleportPlayerTo(ClientProxy client, Vector2 position, double orientation, bool informClientToo){
    client.movable.position = position;
    client.movable.orientation = orientation;
    client.movable.canMove = true;
    client.movable.velocity = new Vector2.zero();
    client.movable.acceleration = new Vector2.zero();
    client.movable.rotationSpeed = 0.0;
    
    updatePlayerEntity(client, informClientToo);
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
  
  
  void updatePlayerEntity(ClientProxy client, bool informPlayerClientToo, {Movable updatedEntity}){
    if(updatedEntity != null){
      client.movable.copyFrom(updatedEntity);            
    }
        
    Message message = new Message(MessageType.ENTITY, client.movable);
    
    if(informPlayerClientToo){
      broadcastMessage(message); 
    }
    else {
      sendMessageToClientsExcept(message, client); 
    }
  }
  
  ClientProxy _clientForEntity(Entity entity){
    return _entityToClientMap[entity];
  }
}
