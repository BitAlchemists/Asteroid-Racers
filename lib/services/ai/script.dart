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

  Script();

  Future run();
  void step(double dt);
}

class TargetScript extends Script {
  int numTargets = 6;
  double targetDistance = 275.0;
  double targetDistanceRange = 25.0;
  Vector2 spawn = new Vector2(-2700.0,1800.0);
  int lifeTimeFrames = 3000~/15; //should be multiples of 15 (milliseconds per frame
  int currentFrames = 0;

  Completer _completer;

  List targets = [];
  int _nextTargetIndex = 0;
  Checkpoint currentTarget;

  TargetScript();

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
        _cleanUpCurrentTarget();
        if(_nextTargetIndex < targets.length){
          _runNextTarget();
        }
        else{
          _finish();
        }
      }
    }
    else {
      print("Trying to step() script, but script state is ${state.toString()}");
    }
  }

  _runNextTarget(){
    //get the next checkpoint
    currentTarget = targets[_nextTargetIndex++];
    currentTarget.state = CheckpointState.CURRENT;
    currentTarget.updateRank += 1.0;

    director.server.teleportPlayerTo(client, spawn, currentTarget.orientation, false);

    Command command = new FlyTowardsTargetCommand(currentTarget.position);
    command.network = network;
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

class CircleTargetScript extends TargetScript {

  CircleTargetScript();

  Future run(){
    _createTargets();
    return super.run();
  }

  _createTargets(){
    for(int i = 0; i < numTargets; i++){
      num angle = (i.toDouble() / numTargets.toDouble());
      double distance = targetDistance + (random.nextDouble()*2-1)*targetDistanceRange;
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * distance, Math.sin(angle * Math.PI * 2) * distance);
      _createTarget(position + spawn);
    }
  }

  _createTarget(Vector2 position){
    Checkpoint checkpoint = new Checkpoint();
    checkpoint.position = position;
    checkpoint.radius = 30.0;
    checkpoint.orientation = random.nextDouble() * Math.PI * 2;
    checkpoint.state = CheckpointState.FUTURE;

    director.server.spawnEntity(checkpoint);
    targets.add(checkpoint);
  }

  _finish(){
    for(Checkpoint target in targets){
      director.server.despawnEntity(target);
    }
    targets.clear();
    super._finish();
  }
}