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
  int nextTargetIndex = 0;

  TargetScript();

  Future run(){
    print("run script");
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
        if(nextTargetIndex < targets.length){
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
    print("run next target");

    //get the next checkpoint
    Checkpoint target;
    target = targets[nextTargetIndex++];
    target.state = CheckpointState.CURRENT;
    target.updateRank += 1.0;

    director.server.teleportPlayerTo(client, spawn, target.orientation, false);

    Command command = new FlyTowardsTargetCommand(target.position);
    command.network = network;
    client.command = command;

    currentFrames = 0;
  }

  _cleanUpCurrentTarget(){
    //get the previous target checkpoint
    Checkpoint target;
    target = targets[nextTargetIndex-1];
    target.state = CheckpointState.FUTURE;
    target.updateRank += 1.0;

    client.command = null;
  }

  _finish(){
    print("finish script");
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

    director.server.world.addEntity(checkpoint);
    targets.add(checkpoint);
  }
}