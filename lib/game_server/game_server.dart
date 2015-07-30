library game_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";

import "package:asteroidracers/shared/shared.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/chat/chat_shared.dart";
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
  PhysicsSimulator _physics;
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
    _race.addCheckpoint(0.0, -600.0, Math.PI);
    //_race.addCheckpoint(0.0, -1700.0);
    _race.addFinish(0.0, -800.0, Math.PI);

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
    _spawn.radius = 200.0;
    _spawn.orientation = Math.PI;
    
    /* Dummy player
    Entity dummyPlayer = new Entity(EntityType.SHIP, new Vector2(50.0, 50.0), 10.0);
    dummyPlayer.displayName = "Dummy";
    _world.addEntity(dummyPlayer);
    _collisionDetector.asteroids.add(dummyPlayer);
    */
    
    _physics = new PhysicsSimulator();
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
    _physics.simulateTranslation(gameLoop.dt);
    _checkCollisions();
    _race.update();
    _broadcastUpdates();
  }
  
  void _checkCollisions()
  {
    _crashCollisionDetector.detectCollisions(_onPlayerCollision);
    _joinRaceCollisionDetector.detectCollisions(_onPlayerTouchRacePortal);
  }
  
  _onPlayerCollision(Movable playerEntity, Entity otherEntity){
    _crashCollisionDetector.activeEntities.remove(playerEntity);
    playerEntity.canMove = false;
    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.COLLISION;
    envelope.payload = playerEntity.id;
    broadcastMessage(envelope);
    
    //respawn
    new Future.delayed(new Duration(seconds:1), (){
      //if the entity still exists
      if(_world.entities.containsKey(playerEntity.id)){
        ClientProxy client = _clientForEntity(playerEntity);
        spawnPlayer(client, true);         
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

    ChatMessage chatMessage = new ChatMessage();
    chatMessage.from = "Server";
    chatMessage.text = "Welcome to the 'Apollo 13' development server.";

    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.CHAT;
    envelope.payload = chatMessage.writeToBuffer();
    client.send(envelope);

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
      _physics.removeMovable(client.movable);
      _world.removeEntity(client.movable);
      _crashCollisionDetector.activeEntities.remove(client.movable);
      _race.removePlayer(client);
      _entityToClientMap.remove(client.movable);
    }

    //TODO: remove this message from game server and move it to the world. Probably via a world update message?
    RemoveEntityCommand command = new RemoveEntityCommand();
    command.entityId = client.movable.id;

    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.ENTITY_REMOVE;
    envelope.payload = command.writeToBuffer();
    sendMessageToClientsExcept(envelope, client);
  }
  
  sendMessageToClientsExcept(Envelope envelope, ClientProxy client){
    broadcastMessage(envelope, blacklist:new Set()..add(client));
  }
  
  broadcastMessage(Envelope envelope, {Set<IClientProxy> blacklist}) {
    Set<IClientProxy> recipients = _clients;    
    
    if(blacklist != null){
      recipients = recipients.difference(blacklist);      
    }
    
    
    for(ClientProxy client in recipients) {
      client.send(envelope);
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
    
    _physics.addMovable(client.movable);
        
    spawnPlayer(client, false);
  }
  
  spawnPlayer(ClientProxy client, bool informClientToo){
    
    Movable movable = client.movable;
    Vector2 position;
    double orientation;
    
    Entity spawn = null;
    
    if(client.race != null){
      spawn = _race.spawnEntityForPlayer(client);
    }
    else {
      spawn = _spawn;
    }

    Vector2 randomPoint = randomPointInCircle();
    position = spawn.position + randomPoint * (spawn.radius - movable.radius);      

    
    orientation = spawn.orientation;

            
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
    
    client.movable.updateRank += 1;
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
  
  void computePlayerInput(ClientProxy client, MovementInput input){
    client.movable.updateRank += 1;
    
    // 1. apply the new orientation
    if(client.movable.orientation != input.newOrientation){
      client.movable.orientation = input.newOrientation;
    }
    
    // 2. calculate the acceleration
    if(input.accelerate){
      double accelerationSpeed = 200.0;
      Vector2 direction = new Vector2(0.0, accelerationSpeed);
    
      // duplicate code in [PlayerController]
      // TODO: this can most propably be calculated in a simpler way. do it!
      Vector3 acceleration3 = 
        new Matrix4.identity().
        rotateZ(client.movable.orientation).
        translate(direction.x, direction.y).
        getTranslation();
    
      client.movable.acceleration = new Vector2(acceleration3.x, acceleration3.y);      
    }
    else
    {
      client.movable.acceleration = new Vector2.zero();
    }
  }
  
  _broadcastUpdates(){
    var entities = _clients.
        where((IClientProxy client) => client.movable != null).
        map((client) => client.movable).
        where((Movable movable) => movable.updateRank > 0).
        toList(growable: false);
    entities.sort((Movable a, Movable b) => (b.updateRank.compareTo(a.updateRank)));
    var broadcastables = entities.take(2);
    
    for(Movable movable in broadcastables){
      movable.updateRank = 0;
      Envelope envelope = new Envelope();
      envelope.messageType = MessageType.ENTITY;
      envelope.payload = movable;
      broadcastMessage(envelope);
    }
    
  }
  
  ClientProxy _clientForEntity(Entity entity){
    return _entityToClientMap[entity];
  }
}
