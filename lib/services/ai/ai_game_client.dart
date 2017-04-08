part of ai;



class AIGameClient implements IGameClient {
  logging.Logger _log = new logging.Logger("ai.AIGameClient");

  String username;
  Map<int, Entity> _entities = <int, Entity>{};
  List<Entity> _otherPlayers = <Entity>[];
  ServerConnection _connection;
  ServerProxy server;
  VehicleController vehicleController;

  Function createPlayerDelegate;
  Function updateEntityDelegate;
  Function joinRaceDelegate;
  Function activateCheckpointDelegate;
  Function handleCollisionDelegate;


  AIGameClient(this._connection){
    server = new ServerProxy(this);
    server.registerMessageHandler(net.MessageType.CHAT, (_){});
    server.onDisconnectDelegate = _onDisconnect;
  }

  destructor(){
    server.onDisconnectDelegate = null;
    server.destructor();
  }

  connect(){
    _log.fine("Connecting...");
    server.connect(_connection, username).then(_onConnect).catchError((_){
      _log.info("could not connect.");
      _onDisconnect();
    });
  }

  _onConnect(_){
    _log.fine("Connected");
  }

  _onDisconnect(){
    _log.fine("Disconnected");
  }

  disconnect(){
    server.disconnect();
  }

  void step(double dt) {
    if(vehicleController != null){
      vehicleController.step(dt);
    }
    else {
      _log.finer("vehicleController == null");
    }
  }

  void createPlayer(Entity entity){
    _log.fine("createPlayer()");
    assert(vehicleController != null);
    vehicleController.movable = entity;
    _entities[entity.id] = entity;

    if(createPlayerDelegate != null){
      createPlayerDelegate();
    }
  }

  void updateEntity(Entity updatingEntity) {
    assert(updatingEntity != null);

    if(updateEntityDelegate != null){
      updateEntityDelegate(updatingEntity);
    }

    // store unknown entities
    if(!_entities.containsKey(updatingEntity.id)){

      bool store = false;

      switch(updatingEntity.type){
        case EntityType.SHIP:
          _otherPlayers.add(updatingEntity);
          store = true;
          break;
        case EntityType.LAUNCH_PLATFORM:
          store = true;
          break;
        case EntityType.CHECKPOINT:
          store = true;
          break;
        case EntityType.FINISH:
          store = true;
          break;
        default:
          break;
      }

      if(store){
        _entities[updatingEntity.id] = updatingEntity;
      }

    }
    else {
      Entity entity = _entities[updatingEntity.id];
      if(entity != null){
        entity.copyFrom(updatingEntity);
      }
    }

  }

  void removeEntity(int entityId){

    if(_entities.containsKey(entityId))
    {
      Entity entity = _entities[entityId];

      if(entity.type == EntityType.SHIP){
        _otherPlayers.remove(entity);
      }
    }

  }

  /// handles a collision event for an entity.
  handleCollision(int entityId)
  {
    Entity entity = _entities[entityId];

    if(entity is Movable){
      (entity as Movable).canMove = false;
    }

    if(handleCollisionDelegate != null){
      handleCollisionDelegate(entity);
    }
  }

  joinRace(int entityId){
    _log.fine("joinRace: $entityId");
    if(joinRaceDelegate != null){
      joinRaceDelegate(entityId);
    }
  }

  //ToDo: find a verb for this method name
  activateNextCheckpoint(int entityId){
    _log.fine("activateNextCheckpoint: $entityId");
    if(activateCheckpointDelegate != null){
      Entity entity = _entities[entityId];
      activateCheckpointDelegate(entity);
    }
  }

  leaveRace(){
    _log.fine("leaveRace");
  }
}