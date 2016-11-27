part of ai;

class RaceTargetScript extends Script {
  Completer _completer;
  TargetVehicleController _vehicleController;
  static const int DELAY = 5;

  Future run(){

      if (state == ScriptState.READY) {
        assert(client != null);

        state = ScriptState.RUNNING;

        _vehicleController = new TargetVehicleController();
        _vehicleController.network = network;
        _vehicleController.client = client;
        client.vehicleController = _vehicleController;
        client.updateEntityDelegate = updateEntity;
        client.activateCheckpointDelegate = activateNextCheckpoint;

        _completer = new Completer();
        return _completer.future;
      }

      else {
        log.warning(
            "Trying to run() script, but script state is ${state.toString()}");
        return new Future.value(null);
      }
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

  _finish(){
    _vehicleController.client = null;
    client.vehicleController = null;
    state = ScriptState.ENDED;
    _completer.complete();
  }
}

class RaceTargetTrainingScript extends Script {

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
    if(state == ScriptState.READY){
      state = ScriptState.RUNNING;

      _vehicleController = new TargetVehicleController();
      _vehicleController.network = network;
      client.vehicleController = _vehicleController;

      _runNextTarget();
      _completer = new Completer();
      return _completer.future;
    }
    else
    {
      log.warning("Trying to run() script, but script state is ${state.toString()}");
      return new Future.value(null);
    }
  }

  void step(double dt){
    if(state == ScriptState.RUNNING)
    {
      //check if the client reached the target
      if(client.movable.position.distanceTo(currentTarget.position)
          < currentTarget.radius)
      {
        _onTargetFinish();
        return;
      }

      if(currentFrames++ >= maxTimePerTarget){
        _onTargetFinish();
      }
    }
    else {
      //print("Trying to step() script, but script state is ${state.toString()} ${this.hashCode}");
    }
  }

  _onTargetFinish(){
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

    _updateVehiclePosition();

    _vehicleController.target = currentTarget;

    currentFrames = 0;
  }

  _updateVehiclePosition(){

  }

  _cleanUpCurrentTarget(){
    //get the previous target checkpoint
    Checkpoint target;
    target = targets[_nextTargetIndex-1];
    target.state = CheckpointState.FUTURE;
    target.updateRank += 1.0;

    client.vehicleController = null;
  }

  _finish(){
    client.vehicleController = null;
    state = ScriptState.ENDED;
    _completer.complete();
  }

}

class RespawnTargetTrainingScript extends RaceTargetTrainingScript {
  RespawnTargetTrainingScript(targets, [spawn, lifeTimeFrames]) : super(targets, spawn, lifeTimeFrames);

  _updateVehiclePosition(){
    IClientProxy clientProxy = director.server.clients.firstWhere((IClientProxy clientProxy) => clientProxy.movable.id == client.movable.id);
    director.server.teleportPlayerTo(clientProxy, spawn, currentTarget.orientation, false);
  }

  bool _didReachTargetCallback(_){
    return true; //continue to execute the command
  }

}