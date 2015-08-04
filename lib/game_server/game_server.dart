library game_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net; //todo: layer the code so that we can remove this.
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/chat/chat_shared.dart";

part "collision_detector.dart";
part "race_controller.dart";

Math.Random random = new Math.Random();

class GameServer implements IGameServer {

  final Set<IClientProxy> _clients = new Set<IClientProxy>();
  final World _world = new World();
  List<IServerService> _services = <IServerService>[];

  CollisionDetector _crashCollisionDetector;
  CollisionDetector _joinRaceCollisionDetector;
  PhysicsSimulator _physics;
  RaceController _race;
  Entity _spawn;
  Map<Entity, IClientProxy> _entityToClientMap = new Map<Entity, IClientProxy>();


  World get world => _world;
  
  // IGameServer
  Set<IClientProxy> get clients => _clients;
  
  GameServer(){
    _createWorld();
  }

  void registerService(IServerService service){
    service.server = this;
    _services.add(service);
  }

  _createWorld(){

    List<Entity> asteroids = new List<Entity>();
    /*
    asteroids.addAll(_world.generateAsteroidBelt(500, -2000, 250, 4000, 4000));
    asteroids.addAll(_world.generateAsteroidBelt(20, -300, -100, 200, -1000));
    asteroids.addAll(_world.generateAsteroidBelt(20, 100, -100, 200, -1000));
    asteroids.addAll(_world.generateAsteroidBelt(20, -150, -1300, 300, -300));
    _world.addEntities(asteroids);
*/
    _crashCollisionDetector = new CollisionDetector();
    _crashCollisionDetector.activeEntitiesCanCollide = true;
    _crashCollisionDetector.passiveEntities = asteroids;

    _configureRace();


    _addArrows({num x: 0.0, num y: 0.0, double orientation: 0.0}){
      Entity arrows = new Entity(type: EntityType.ARROWS);
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
    _spawn = new Entity(type: EntityType.UNKNOWN);
    //_spawn.position = new Vector2(0.0, 100.0);
    _spawn.position = new Vector2(0.0, 0.0);

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

  _configureRace(){
    _race = new RaceController();
    _race.gameServer = this;
    _joinRaceCollisionDetector = new CollisionDetector();

    /*
    _race.addStart(0.0, -200.0, Math.PI);
    _race.addCheckpoint(0.0, -600.0, Math.PI);
    _race.addFinish(0.0, -800.0, Math.PI);

    _joinRaceCollisionDetector.passiveEntities = [_race.start];

    _world.addEntities(_race.checkpoints);
    _world.addEntity(_race.start);
    _world.addEntity(_race.finish);
    */
  }

  start(){
      // Construct a game loop.
      GameLoop gameLoop = new GameLoopIsolate();
      gameLoop.onUpdate = (_onHeartBeat);
      gameLoop.start();

      for(IServerService service in _services){
        service.start();
      }

  }
  
  //Heart Beat
  
  _onHeartBeat(GameLoop gameLoop){
    //print('${gameLoop.frame}: ${gameLoop.gameTime} [dt = ${gameLoop.dt}].');
    try{

      // pre update
      for(IServerService service in _services){
        service.preUpdate(gameLoop.dt);
      }
      _physics.simulateTranslation(0.015);

      // update
      for(IServerService service in _services){
        service.update(gameLoop.dt);
      }
      _checkCollisions();
      _race.update();

      // post update
      for(IServerService service in _services){
        service.postUpdate(gameLoop.dt);
      }
      _broadcastUpdates();
    }
    catch(e, stack)
    {
      print("exceltion in _onHeartBeat()");
      print(e);
      print(stack);
    }
  }
  
  void _checkCollisions()
  {
    _crashCollisionDetector.detectCollisions(_onPlayerCollision);
    _joinRaceCollisionDetector.detectCollisions(_onPlayerTouchRacePortal);
  }
  
  _onPlayerCollision(Movable playerEntity, Entity otherEntity){
    _crashCollisionDetector.activeEntities.remove(playerEntity);
    playerEntity.canMove = false;

    //todo: can we remove this message from GameServer?
    net.IntMessage message = new net.IntMessage();
    message.integer = playerEntity.id;
    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.COLLISION;
    envelope.payload = message.writeToBuffer();
    broadcastMessage(envelope);
    
    //respawn
    new Future.delayed(new Duration(seconds:1), (){
      //if the entity still exists
      if(_world.entities.containsKey(playerEntity.id)){
        IClientProxy client = _clientForEntity(playerEntity);
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
  
  void connectClient(IClientProxy client){
    _clients.add(client);

    ChatMessage chatMessage = new ChatMessage();
    chatMessage.from = "Server";
    chatMessage.text = "Welcome to the 'Apollo 13' development server.";

    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.CHAT;
    envelope.payload = chatMessage.writeToBuffer();
    client.send(envelope);

    print("player connected. connected clients: ${_clients.length}");
  }
  
  void disconnectClient(IClientProxy client){
    
    if(client.movable == null || client.movable.displayName == null)
    {
      print("client disconnected before handshake");
    }

    _clients.remove(client);
    print("player ${client.movable.displayName} disconnected. connected clients: ${_clients.length}");
    
    if(client.movable != null){
      _physics.removeMovable(client.movable);
      _world.removeEntity(client.movable);
      _crashCollisionDetector.activeEntities.remove(client.movable);
      _race.removePlayer(client);
      _entityToClientMap.remove(client.movable);

      //TODO: remove this message from game server and move it to the world. Probably via a world update message?
      net.IntMessage message = new net.IntMessage();
      message.integer = client.movable.id;

      net.Envelope envelope = new net.Envelope();
      envelope.messageType = net.MessageType.ENTITY_REMOVE;
      envelope.payload = message.writeToBuffer();
      sendMessageToClientsExcept(envelope, client);
    }
  }
  
  sendMessageToClientsExcept(net.Envelope envelope, IClientProxy client){
    broadcastMessage(envelope, blacklist:new Set()..add(client));
  }
  
  broadcastMessage(net.Envelope envelope, {Set<IClientProxy> blacklist}) {
    Set<IClientProxy> recipients = _clients.toSet(); //make a copy to prevent concurrent modification exceptions
    
    if(blacklist != null){
      recipients = recipients.difference(blacklist);      
    }
    
    
    for(IClientProxy client in recipients) {
      client.send(envelope);
    }
  }
  
  void registerPlayer(IClientProxy client, String desiredUsername){
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
  
  spawnPlayer(IClientProxy client, bool informClientToo){
    
    Movable movable = client.movable;
    Vector2 position;
    double orientation;
    
    Entity spawn = null;


    if(_race.isClientInRace(client)){
      spawn = _race.spawnEntityForPlayer(client);
    }
    else {
      spawn = _spawn;
    }

    Vector2 randomPoint = randomPointInCircle();
    position = spawn.position + randomPoint * (spawn.radius - movable.radius);      

    
    orientation = spawn.orientation;

            
    if(!_crashCollisionDetector.activeEntities.contains(movable)){
      //_crashCollisionDetector.activeEntities.add(movable);
    }
    
    teleportPlayerTo(client, position, orientation, false);
  }
  
  void teleportPlayerTo(IClientProxy client, Vector2 position, double orientation, bool informClientToo){
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
  
  void computePlayerInput(IClientProxy client, MovementInput input){
    client.movable.updateRank += 1;

    if(input.accelerationFactor < 0.0) {
      print("getting unsanitized input from ${client.playerName}");
      input.accelerationFactor = 0.0;
    }

    if(input.accelerationFactor > 1.0) {
      print("getting unsanitized input from ${client.playerName}");
      input.accelerationFactor = 1.0;
    }

    // 1. apply the new orientation
    if(client.movable.orientation != input.newOrientation){
      client.movable.orientation = input.newOrientation;
    }
    
    // 2. calculate the acceleration
    if(input.accelerationFactor != 0.0){
      double accelerationSpeed = 200.0 * input.accelerationFactor;
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
    var entities = _world.entities.values.
        where((Entity entity) => entity.updateRank > 0).
        toList(growable: false);
    entities.sort((Entity a, Entity b) => (b.updateRank.compareTo(a.updateRank)));

    for(Entity entity in entities){
      entity.updateRank += 1;
    }

    var broadcastables = entities.take(2);
    
    for(Entity entity in broadcastables){
      entity.updateRank = 0;
      net.Envelope envelope = new net.Envelope();
      envelope.messageType = net.MessageType.ENTITY;
      envelope.payload = net.EntityMarshal.worldEntityToNetEntity(entity).writeToBuffer();
      broadcastMessage(envelope);
    }
    
  }
  
  IClientProxy _clientForEntity(Entity entity){
    return _entityToClientMap[entity];
  }
}
