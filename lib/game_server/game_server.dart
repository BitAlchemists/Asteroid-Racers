library game_server;

import "dart:math" as Math;
import "dart:async";

import 'package:game_loop/game_loop_isolate.dart';
import "package:vector_math/vector_math.dart";
import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net; //todo: layer the code so that we can remove this.
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/chat/chat_shared.dart";

part "collision_detector.dart";
part "race_controller.dart";
part "scene_controller.dart";

Math.Random random = new Math.Random();

class GameServer implements IGameServer {
  logging.Logger log = new logging.Logger("GameServer");

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
  
  GameServer();

  void registerService(IServerService service){
    service.server = this;
    _services.add(service);
  }

  void prepareDemoConfiguration(){
    _createWorld();
  }

  _setup(){
    _physics = new PhysicsSimulator();

    // Spawn
    _spawn = new Entity(type: EntityType.UNKNOWN);
    _spawn.position = new Vector2(0.0, 0.0);
    _spawn.radius = 100.0;
    _spawn.orientation = Math.PI;

  }

  _createWorld(){

    //_prepareScene2();

    // Collision Detection
    _crashCollisionDetector = new CollisionDetector();
    _crashCollisionDetector.activeEntitiesCanCollide = true;
    _crashCollisionDetector.passiveEntities.addAll(world.passiveCollissionEntities);

    /* Dummy player
    Entity dummyPlayer = new Entity(EntityType.SHIP, new Vector2(50.0, 50.0), 10.0);
    dummyPlayer.displayName = "Dummy";
    _world.addEntity(dummyPlayer);
    _collisionDetector.asteroids.add(dummyPlayer);
    */
  }

  _prepareScene2(){
    // Scene
    SceneController.createScene2(world);
    //SceneController.createSmallDensityField(world);

    _joinRaceCollisionDetector = new CollisionDetector();

    // Race
    _race = new RaceController();
    _race.gameServer = this;
    SceneController.createRace2(world, _race);
    //SceneController.createRandomRace(world, _race);

    _joinRaceCollisionDetector.passiveEntities.add(_race.start);

  }


  start([GameLoop gameLoop]){
    _setup();
      // Construct a game loop.
    if(gameLoop == null){
      gameLoop = new GameLoopIsolate();
    }
    gameLoop.onUpdate = (_onHeartBeat);
    gameLoop.start();

    for(IServerService service in _services){
      service.start();
    }
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

    log.fine("connectClient() connected clients: ${_clients.length}");
  }
  
  void disconnectClient(IClientProxy client){
    
    if(client.movable == null || client.movable.displayName == null)
    {
      log.info("client disconnected before handshake");
    }

    _clients.remove(client);
    log.fine("disconnectClient() ${client.movable.displayName}. connected clients: ${_clients.length}");
    
    if(client.movable != null){
      _physics.removeMovable(client.movable);
      if(_crashCollisionDetector != null){
        _crashCollisionDetector.activeEntities.remove(client.movable);
      }
      clientLeavesRace(client);
      _entityToClientMap.remove(client.movable);
      despawnEntity(client.movable);
    }

    client.handleDisconnect();
  }

  //Heart Beat

  _onHeartBeat(GameLoop gameLoop){
    log.finest('begin frame ${gameLoop.frame}: ${gameLoop.gameTime} [dt = ${gameLoop.dt}].');
    try{

      // pre update
      for(IServerService service in _services){
        service.preUpdate(gameLoop.dt);
      }

      _physics.simulateRotation(0.015);
      _physics.simulateTranslation(0.015);

      // update
      for(IServerService service in _services){
        service.update(gameLoop.dt);
      }
      _checkCollisions();
      if (_race != null) _race.update();

      // post update
      for(IServerService service in _services){
        service.postUpdate(gameLoop.dt);
      }
      _broadcastUpdates();
    }
    catch(e, stack)
    {
      print(e);
      print(stack);
    }
    log.finest('end frame ${gameLoop.frame}');
  }

  void _checkCollisions()
  {
    if(_crashCollisionDetector != null){
      _crashCollisionDetector.detectCollisions(_onPlayerCollisionExplode);
    }
    //_crashCollisionDetector.detectCollisions(_onPlayerCollisionBounce);
    if(_joinRaceCollisionDetector != null){
      _joinRaceCollisionDetector.detectCollisions(_onPlayerTouchRacePortal);
    }
  }


  _onPlayerCollisionBounce(Movable playerEntity, Entity otherEntity, double penetration){
    logging.Logger log = new logging.Logger("GameServer.CollisionBounce");
    log.level = logging.Level.ALL;

    //setup
    double m1 = 1.0;
    double m2 = 1.0;
    double elasticity1 = 2.0;
    double elasticity2 = 0.5;

    Vector2 vel1 = playerEntity.velocity;
    Vector2 vel2;

    log.finest(playerEntity.velocity);

    if(otherEntity is Movable){
      Movable otherMovable = otherEntity;
      vel2 = otherMovable.velocity;
    }
    else{
      vel2 = new Vector2.zero();
    }

    Vector2 norm = playerEntity.position - otherEntity.position;
    norm.normalize();

    double closingVel = (vel1 - vel2).dot(norm);

    //calculate impuls
    double impulse1 = - (1+elasticity1)*closingVel / (1/m1 + 1/m2);
    //double impulse2 = - (1+elasticity2)*closingVel / (1/m1 + 1/m2);

    Vector2 positionCorrection = norm * ( m2/(m1+m2) * penetration );
    playerEntity.position += positionCorrection;
    //otherEntity.position += norm * ( m1/(m1+m2) * penetration );

    // repulsive collision
    Vector2 velocityCorrection = norm * (impulse1/m1);
    playerEntity.velocity += velocityCorrection;

    playerEntity.updateRank += 1;
  }

  _onPlayerCollisionExplode(Movable playerEntity, Entity otherEntity, double penetration){
    log.info("_onPlayerCollisionExplode() - ${playerEntity.displayName} collided with ${otherEntity.displayName}");
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

  _onPlayerTouchRacePortal(Movable playerEntity, RacePortal portal, double penetration){
    var player = _clientForEntity(playerEntity);
    _joinRaceCollisionDetector.activeEntities.remove(playerEntity);
    portal.raceController.addPlayer(player);
  }

  void clientLeavesRace(IClientProxy client){
    if(_race != null) _race.removePlayer(client);
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
  
  void registerPlayer(IClientProxy client, String desiredUsername, [bool canCollide = true]){
    //log.info("player identifies as $desiredUsername");
    Movable player = new Movable();
    player.type = EntityType.SHIP;
    player.radius = 20.0;
    player.displayName = desiredUsername;

    spawnEntity(player);
    
    _entityToClientMap[player] = client;
    
    client.movable = player;

    if(canCollide){
      if(_joinRaceCollisionDetector != null){
        _joinRaceCollisionDetector.activeEntities.add(client.movable);
      }
    }

    _physics.addMovable(client.movable);
        
    spawnPlayer(client, false, canCollide);
  }
  
  spawnPlayer(IClientProxy client, bool informClientToo, [bool canCollide = true]){
    
    Movable movable = client.movable;
    Vector2 position;
    double orientation;
    
    Entity spawn = null;


    if(_race != null && _race.isClientInRace(client)){
      spawn = _race.spawnEntityForPlayer(client);
    }
    else {
      spawn = _spawn;
    }

    Vector2 randomPoint = randomPointInCircle();
    position = spawn.position + randomPoint * (spawn.radius - movable.radius);      

    
    orientation = spawn.orientation;

            
    if(_crashCollisionDetector != null &&
        !_crashCollisionDetector.activeEntities.contains(movable) &&
        canCollide){
      _crashCollisionDetector.activeEntities.add(movable);
    }
    
    teleportPlayerTo(client, position, orientation, false);
  }
  
  void teleportPlayerTo(IClientProxy client, Vector2 position, double orientation, bool informClientToo){
    log.fine("teleporting ${client.playerName} to ${position.x} ${position.y}");

    assert(position != null);
    client.movable.position = position;
    client.movable.orientation = orientation;
    client.movable.canMove = true;
    client.movable.velocity = new Vector2.zero();
    client.movable.acceleration = new Vector2.zero();
    client.movable.rotationSpeed = 0.0;
    
    client.movable.updateRank += 1;
  }

  /// This function returns a random point in the circle
  /// It does this by randomly generating a point in a rect around the circle.
  /// If the position is within the circle, this becomes the spawn point.
  /// Else, a new spawn random point will be generated and tested for.
  /// This provides a uniform random point selection, opposed to selecting
  /// a random angle and random distance, which would create more spawn density
  /// towards the center
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
      log.warning("getting unsanitized input from ${client.playerName}");
      input.accelerationFactor = 0.0;
    }

    if(input.accelerationFactor > 1.0) {
      log.warning("getting unsanitized input from ${client.playerName}");
      input.accelerationFactor = 1.0;
    }

    // 1. apply the new orientation
    if(client.movable.orientation != input.newOrientation && !input.newOrientation.isNaN){
      client.movable.orientation = input.newOrientation;
    }

    if(client.movable.rotationSpeed != input.rotationSpeed && !input.rotationSpeed.isNaN){
      client.movable.rotationSpeed = input.rotationSpeed;
    }

    // 2. calculate the acceleration
    if(input.accelerationFactor != 0.0){
      double accelerationSpeed = 400.0 * input.accelerationFactor;
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

  spawnEntity(Entity entity){
    _world.addEntity(entity);
    entity.updateRank += 1.0;
  }

  despawnEntity(Entity entity){
    _world.removeEntity(entity);

    //TODO: remove this message from game server and move it to the world. Probably via a world update message?
    net.IntMessage message = new net.IntMessage();
    message.integer = entity.id;

    net.Envelope envelope = new net.Envelope();
    envelope.messageType = net.MessageType.ENTITY_REMOVE;
    envelope.payload = message.writeToBuffer();
    broadcastMessage(envelope);
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
