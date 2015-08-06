part of ai;

enum ScriptState {
  READY,
  RUNNING,
  ENDED
}

abstract class Script {
  ScriptState state = ScriptState.READY;
  AIDirector director;
  AIClientProxy client;
  Network network;
  Evaluator evaluator;

  Script();

  Future run();
  void step(double dt);
}

class TargetScript extends Script {
  int lifeTimeFrames = 6000~/15; //should be multiples of 15 (milliseconds per frame
  int currentFrames = 0;
  Vector2 spawn;

  Completer _completer;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  TargetScript(this.targets, [this.spawn]){
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
      print("Trying to run() script, but script state is ${state.toString()}");
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
      print("Trying to step() script, but script state is ${state.toString()}");
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

    director.server.teleportPlayerTo(client, spawn, currentTarget.orientation, false);

    FlyTowardsTargetCommand command = new FlyTowardsTargetCommand(currentTarget);
    command.network = network;
    command.didReachTargetCallback = (_){
      _onTargetFinish();
      return false; //don't continue to execute the command
    };
    client.command = command;


    currentFrames = 0;
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
  static List<Entity> setupTargets(
      IGameServer server,
      {Vector2 center,
      int numTargets: 6,
      double targetDistance: 275.0,
      double targetDistanceRange: 25.0,
      double radius:60.0}){

    if(center == null){
      center = new Vector2.zero();
    }

    var targets = _createTargets(numTargets, targetDistance, targetDistanceRange, center);
    targets = targets.map((Vector2 position) => _createCheckpoint(position, radius)).toList();
    targets.forEach((Entity entity) => server.spawnEntity(entity));
    return targets;
  }

  static void teardownTargets(IGameServer server, List targets){
    for(Checkpoint target in targets){
      server.despawnEntity(target);
    }
    targets.clear();
  }

  static List<Vector2> _createTargets(int numTargets, double targetDistance, double targetDistanceRange, Vector2 center){
    return new List<Vector2>.generate(numTargets,(index){
      num angle = (index.toDouble() / numTargets.toDouble());
      double distance = targetDistance + (random.nextDouble()*2-1)*targetDistanceRange;
      Vector2 offset = new Vector2(Math.cos(angle * Math.PI * 2) * distance, Math.sin(angle * Math.PI * 2) * distance);
      return center + offset;
    });
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