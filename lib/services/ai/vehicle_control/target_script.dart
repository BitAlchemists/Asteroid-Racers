part of ai;

class RaceTargetScript extends Script {
  Completer _completer;
  TargetVehicleController _vehicleController;
  static const int DELAY = 5; // we use this delay to allow game testers to join the server before the AI begins to run
  logging.Logger _log = new logging.Logger("ai.RaceTargetScript");

  Future run(){

      if (state == ScriptState.READY) {
        assert(client != null);

        _vehicleController = new TargetVehicleController();
        _vehicleController.network = network;
        _vehicleController.client = client;
        client.vehicleController = _vehicleController;
        client.updateEntityDelegate = updateEntity;
        client.activateCheckpointDelegate = activateNextCheckpoint;

        state = ScriptState.RUNNING;

        _completer = new Completer();
        return _completer.future;
      }

      else {
        _log.warning(
            "Trying to run() script, but script state is ${state.toString()}");
        return new Future.value(null);
      }
  }

  _finish(){
    state = ScriptState.ENDED;
    _vehicleController.client.vehicleController = null;
    _vehicleController.client.updateEntityDelegate = null;
    _vehicleController.client.activateCheckpointDelegate = null;
    _vehicleController.client = null;
    _vehicleController.network = null;
    client.vehicleController = null;

    _completer.complete();
  }


  void step(double dt){

  }

  updateEntity(Entity entity) {
    if (entity.type == EntityType.LAUNCH_PLATFORM &&
        _vehicleController.target == null) {
      new Timer(new Duration(seconds: DELAY), (){
        _vehicleController.target = entity;
      });
    }
  }

  activateNextCheckpoint(Entity entity){
    new Timer(new Duration(seconds: DELAY), () {
      _vehicleController.target = entity;
    });
  }
}

class RaceTargetTrainingScript extends Script {

  logging.Logger _log = new logging.Logger("ai.RaceTargetTrainingScript");
  // lifetime is counted in frames to allow every Bot to live for the same time. We use frames for lifetime measurement
  // so that every AI gets the same amount of frames to prove their value. Every frame is about 15 milliseconds long
  // should be multiples of 15 (milliseconds per frame)
  static const int maxTimePerTargetDefault = 4500~/15;
  int maxTimePerTarget;
  int currentFrames = 0;
  Vector2 spawn;
  TargetVehicleController _vehicleController;

  Completer _completer;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  RaceTargetTrainingScript(this.targets, [this.spawn, this.maxTimePerTarget = maxTimePerTargetDefault]){
    if(spawn == null){
      spawn = new Vector2.zero();
    }
  }

  Future run(){
    _log.fine("run() " + this.hashCode.toString());

    if(state == ScriptState.READY){
      _vehicleController = new TargetVehicleController();
      _vehicleController.network = network;
      _vehicleController.client = client;
      client.vehicleController = _vehicleController;
      client.createPlayerDelegate = createPlayer;
      client.activateCheckpointDelegate = activateNextCheckpoint;
      client.handleCollisionDelegate = handleCollision;

      _completer = new Completer();
      return _completer.future;
    }
    else
    {
      _log.warning("Trying to run() script, but script state is ${state.toString()}");
      return new Future.value(null);
    }
  }


  _finish(){
    _log.fine("finish() " + this.hashCode.toString());
    state = ScriptState.ENDED;

    client.handleCollisionDelegate = null;
    client.activateCheckpointDelegate = null;
    client.createPlayerDelegate = null;
    client.vehicleController = null;
    _vehicleController.client = null;
    _vehicleController.network = null;
    _vehicleController = null;
    _completer.complete();
  }

  void createPlayer(){
    _runNextTarget();
    state = ScriptState.RUNNING;
  }

  void activateNextCheckpoint(Entity entity){
    _vehicleController.target = entity;
  }

  void handleCollision(Entity entity){
    _log.fine("handleCollision() " + this.hashCode.toString());
    if(entity.id == _vehicleController.movable.id){
      _updateVehiclePosition();
    }
  }

  void step(double dt){
    if(state == ScriptState.RUNNING)
    {
      if(_vehicleController.movable == null){
        _log.warning("step() assertion _vehicleController.movable " + this.hashCode.toString());
        assert(_vehicleController.movable != null);
      }

      //check if the client reached the target
      if(_didReachTarget())
      {
        _log.fine("did reach target. finishing...");
        _onTargetFinish();
        return;
      }

      if(currentFrames++ >= maxTimePerTarget){
        _log.fine("time to reach target elapsed. finishing at position ${_vehicleController.movable.position.x} ${_vehicleController.movable.position.y}...");
        _onTargetFinish();
      }
    }
    else {
      //print("Trying to step() script, but script state is ${state.toString()} ${this.hashCode}");
    }
  }

  bool _didReachTarget(){
    return _vehicleController.movable.position.distanceTo(currentTarget.position) < currentTarget.radius;
  }

  _onTargetFinish(){
    _log.fine("onTargetFinish()");
    _cleanUpCurrentTarget();
    if(_nextTargetIndex < targets.length){
      _runNextTarget();
    }
    else{
      _finish();
    }
  }

  _runNextTarget(){
    //get the next checkpoint
    currentTarget = targets[_nextTargetIndex++];
    currentTarget.state = CheckpointState.CURRENT;
    currentTarget.updateRank += 1.0;

    _log.fine("runNextTarget() at ${currentTarget.position.x} ${currentTarget.position.y}");

    _updateVehiclePosition();

    _vehicleController.target = currentTarget;

    currentFrames = 0;
  }

  _updateVehiclePosition(){

  }

  _cleanUpCurrentTarget(){
    _log.fine("cleanUpCurrentTarget()");
    //get the previous target checkpoint
    Checkpoint target;
    target = targets[_nextTargetIndex-1];
    target.state = CheckpointState.FUTURE;
    target.updateRank += 1.0;
  }

}

class RespawnTargetTrainingScript extends RaceTargetTrainingScript {
  RespawnTargetTrainingScript(targets, [spawn, lifeTimeFrames]) : super(targets, spawn, lifeTimeFrames);

  _updateVehiclePosition(){
    IClientProxy clientProxy = director.server.clients.firstWhere((IClientProxy clientProxy) => clientProxy.movable.id == _vehicleController.movable.id);
    director.server.teleportPlayerTo(clientProxy, spawn, currentTarget.orientation, false);
  }

  bool _didReachTarget(){
    return false; //continue to execute the command
  }

}