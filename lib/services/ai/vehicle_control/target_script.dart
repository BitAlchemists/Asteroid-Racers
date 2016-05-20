part of ai;



class RaceTargetScript extends Script {

  // lifetime is counted in frames to allow every Bot to live for the same time. We use frames for lifetime measurement
  // so that every AI gets the same amount of frames to prove their value. Every frame is about 15 milliseconds long
  // should be multiples of 15 (milliseconds per frame)
  static const int lifeTimeFramesDefault = 4500~/15;
  int lifeTimeFrames;
  int currentFrames = 0;
  Vector2 spawn;

  Completer _completer;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  RaceTargetScript(this.targets, [this.spawn, this.lifeTimeFrames = lifeTimeFramesDefault]){
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
      if(currentFrames++ >= lifeTimeFrames){
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
    command.didReachTargetCallback = (_){
      //_onTargetFinish();
      //return false; //don't continue to execute the command
      return true;
    };
    client.command = command;


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

    client.command = null;
  }

  _finish(){
    state = ScriptState.ENDED;
    _completer.complete();
  }

}

class CircleTargetGenerator {
  static List<Entity> setupRandomTargets(
      IGameServer server,
      {Vector2 center,
      int numTargets: 20,
      double targetDistance: 800.0,
      double targetDistanceRange: 200.0,
      double radius:30.0}){

    if(center == null){
      center = new Vector2.zero();
    }

    var targets = _createTargets(numTargets, targetDistance, targetDistanceRange, center);
    targets = targets.map((Vector2 position) => _createCheckpoint(position, radius)).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static List<Entity> setupTargets(
      IGameServer server,
      {Vector2 center,
      double radius:30.0}){

    if(center == null){
      center = new Vector2.zero();
    }

    List<Vector2> targets = new List<Vector2>();
    targets.addAll(_createTargets(1, 0.0, 0.0, center));
    targets.addAll(_createTargets(3, 200.0, 0.0, center));
    targets.addAll(_createTargets(3, 400.0, 0.0, center));
    targets.addAll(_createTargets(3, 600.0, 0.0, center));
    targets.addAll(_createTargets(3, 800.0, 0.0, center));
    targets.addAll(_createTargets(3, 1000.0, 0.0, center));
    targets = targets.map((Vector2 position) => _createCheckpoint(position, radius)).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static List<Vector2> _createTargets(int numTargets, double targetDistance, double targetDistanceRange, Vector2 center){
    return new List<Vector2>.generate(numTargets,(index){
      num angle = (index.toDouble() / numTargets.toDouble());
      double distance = targetDistance + (random.nextDouble()*2-1)*targetDistanceRange;
      Vector2 offset = new Vector2(Math.cos(angle * Math.PI * 2) * distance, Math.sin(angle * Math.PI * 2) * distance);
      return center + offset;
    });
  }

  static void teardownTargets(IGameServer server, List targets){
    for(Checkpoint target in targets){
      server.despawnEntity(target);
    }
    targets.clear();
  }

  static Checkpoint _createCheckpoint(Vector2 position, double radius){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = position;
    checkpoint.radius = radius;
    checkpoint.orientation = random.nextDouble() * Math.PI * 2;
    checkpoint.state = CheckpointState.FUTURE;
    return checkpoint;
  }

}

class RespawnTargetScript extends RaceTargetScript {
  RespawnTargetScript(targets, [spawn, lifeTimeFrames]) : super(targets, spawn, lifeTimeFrames);

  _updateVehiclePosition(){
    director.server.teleportPlayerTo(client, spawn, currentTarget.orientation, false);
  }

}