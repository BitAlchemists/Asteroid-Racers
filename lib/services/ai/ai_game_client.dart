part of ai;



class AIGameClient implements IGameClient {
  logging.Logger log = new logging.Logger("AIGameClient");

  String username;
  Map<int, Entity> _entities = <int, Entity>{};
  List<Entity> _otherPlayers = <Entity>[];
  ServerConnection _connection;
  ServerProxy server;
  VehicleController vehicleController;
  //Movable movable; //is this needed?

  Function updateEntityDelegate;
  Function joinRaceDelegate;
  Function activateCheckpointDelegate;


  AIGameClient(this._connection){
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
  }

  connect(){
    log.info("Connecting...");
    server.connect(_connection, username).then(_onConnect).catchError((_){
      log.info("could not connect.");
      _onDisconnect();
    });
  }

  _onConnect(_){
    log.info("Connected");
  }

  _onDisconnect(){
    log.info("Disconnected");
  }

  disconnect(){
    server.disconnect();
  }

  void step(double dt) {
    if(vehicleController != null){
      vehicleController.step(dt);
    }
    else {
      log.finer("vehicleController == null");
    }
  }

  void createPlayer(Entity entity){
    assert(vehicleController != null);
    //movable = entity;
    vehicleController.movable = entity;
    _entities[entity.id] = entity;
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
  ///
  /// the entity will be stopped from moving and an explosion sprite will be rendered
  handleCollision(int entityId)
  {
    Entity entity = _entities[entityId];

    if(entity is Movable){
      (entity as Movable).canMove = false;
    }
  }

  joinRace(int entityId){
    log.fine("joinRace: $entityId");
    if(joinRaceDelegate != null){
      joinRaceDelegate(entityId);
    }
  }

  //ToDo: find a verb for this method name
  activateNextCheckpoint(int entityId){
    log.fine("activateNextCheckpoint: $entityId");
    if(activateCheckpointDelegate != null){
      Entity entity = _entities[entityId];
      activateCheckpointDelegate(entity);
    }
  }

  leaveRace(){
    log.fine("leaveRace");
  }
}