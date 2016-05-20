part of ai;



class RaceTargetScript extends Script {

  // lifetime is counted in frames to allow every Bot to live for the same time. We use frames for lifetime measurement
  // so that every AI gets the same amount of frames to prove their value. Every frame is about 15 milliseconds long
  // should be multiples of 15 (milliseconds per frame)
  static const int maxTimePerTargetDefault = 4500~/15;
  int maxTimePerTarget;
  int currentFrames = 0;
  Vector2 spawn;

  Completer _completer;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  RaceTargetScript(this.targets, [this.spawn, this.maxTimePerTarget = maxTimePerTargetDefault]){
    if(spawn == null){
      spawn = new Vector2.zero();
    }
  }

  Future run(){
    if(state == ScriptState.READY){
      state = ScriptState.RUNNING;
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

    TargetVehicleController command = new TargetVehicleController(currentTarget);
    command.network = network;
    command.didReachTargetCallback = _didReachTargetCallback;
    client.command = command;


    currentFrames = 0;
  }

  bool _didReachTargetCallback(_){
    _onTargetFinish();
    return false; //don't continue to execute the command
  }

  _updateVehiclePosition(){

  }

  _cleanUpCurrentTarget(){
    //get the previous target checkpoint
    Checkpoint target;
    target = targets[_nextTargetIndex-1];
    target.state = CheckpointState.FUTURE;
    target.updateRank += 1.0;

    client.command = null;
  }

  _finish(){
    state = ScriptState.ENDED;
    _completer.complete();
  }

}

class RespawnTargetScript extends RaceTargetScript {
  RespawnTargetScript(targets, [spawn, lifeTimeFrames]) : super(targets, spawn, lifeTimeFrames);

  _updateVehiclePosition(){
    director.server.teleportPlayerTo(client, spawn, currentTarget.orientation, false);
  }

  bool _didReachTargetCallback(_){
    return true; //continue to execute the command
  }

}