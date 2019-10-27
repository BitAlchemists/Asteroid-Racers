part of ai;

/**
 * For use in a training context to respawn after each attempt to reach a target
 */
class RaceTargetTrainingScript extends NetworkTrainingScript {
  NeuralNetwork network;
  Evaluator evaluator;
  AIGameClient client;

  TargetVehicleController _vehicleController;
  Completer _completer;

  logging.Logger log = new logging.Logger("services.ai.vehicle_control.RaceTargetTrainingScript");
  // lifetime is counted in frames to allow every Bot to live for the same time. We use frames for lifetime measurement
  // so that every AI gets the same amount of frames to prove their value. Every frame is about 15 milliseconds long
  // should be multiples of 15 (milliseconds per frame)
  static const int maxTimePerTargetDefault = 4500~/15;
  int maxTimePerTarget;
  int currentFrames = 0;
  Vector2 spawn;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  RaceTargetTrainingScript(this.network, this.targets, [this.spawn, this.maxTimePerTarget = maxTimePerTargetDefault]){
    if(spawn == null){
      spawn = new Vector2.zero();
    }
  }



  Future run() async{
    log.fine("run()");
    if (state == ScriptState.READY) {
      client = await director.createClient();
      _vehicleController = new TargetVehicleController();
      _vehicleController.network = network;
      _vehicleController.client = client;
      client.vehicleController = _vehicleController;

      await client.connect();

      _runNextTarget();

      state = ScriptState.RUNNING;

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
    log.finest("step()");
    if(state == ScriptState.RUNNING)
    {
      //check if the client reached the target
      if(client.vehicleController.movable.position.distanceTo(currentTarget.position)
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

  _runNextTarget(){
    log.fine("_runNextTarget()");
    //get the next checkpoint
    currentTarget = targets[_nextTargetIndex++];
    currentTarget.state = CheckpointState.CURRENT;
    currentTarget.updateRank += 1.0;

    _updateVehiclePosition();

    _vehicleController.target = currentTarget;

    currentFrames = 0;
  }

  _onTargetFinish(){
    log.fine("_onTargetFinish()");
    _cleanUpCurrentTarget();
    if(_nextTargetIndex < targets.length){
      _runNextTarget();
    }
    else{
      _finish();
    }
  }

  _updateVehiclePosition(){
    log.fine("_updateVehiclePosition()");

  }

  _cleanUpCurrentTarget(){
    log.fine("_cleanUpCurrentTarget()");
    //get the previous target checkpoint
    Checkpoint target;
    target = targets[_nextTargetIndex-1];
    target.state = CheckpointState.FUTURE;
    target.updateRank += 1.0;
  }


  _finish(){
    log.fine("_finish()");
    client.disconnect();
    client.vehicleController = null;

    _vehicleController.network = null;
    _vehicleController.client = null;
    _vehicleController = null;

    director.destroyClient(client);
    client = null;

    state = ScriptState.ENDED;
    _completer.complete();
  }

}



class RespawnTargetTrainingScript extends RaceTargetTrainingScript {
  RespawnTargetTrainingScript(network, targets, [spawn, lifeTimeFrames]) : super(network, targets, spawn, lifeTimeFrames);

  _updateVehiclePosition(){
    IClientProxy clientProxy = director.server.clients.firstWhere((IClientProxy clientProxy) => clientProxy.movable.id == client.vehicleController.movable.id);
    director.server.teleportPlayerTo(clientProxy, spawn, currentTarget.orientation, false);
  }

/*
  bool _didReachTargetCallback(_){
    return true; //continue to execute the command
  }
  */

}