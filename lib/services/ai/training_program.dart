part of ai;

class TrainingProgramInstance {
  MajorTom network;
  TrainingProgram program;
  AIClientProxy client;

  TrainingProgramInstance(this.program, this.network);

  double highscore = double.MAX_FINITE;
  double score;

  updateHighscores(){
    assert(score != 0.0);
    assert(highscore != 0.0);
    highscore = betterReward(score, highscore);
  }

/*
  double get score {
    double result = 0.0;

    for(TrainingUnit unit in this.trainingUnits){
      result += unit.score;
    }

    return result/this.trainingUnits.length; //returns the average reward
  }*/
}

abstract class TrainingUnit {
  Future run(TrainingProgramInstance instance);
}

class TrainingProgram implements TrainingUnit {
  List<TrainingUnit> trainingUnits;
  IGameServer server;

  TrainingProgram();
  void setUp(){}
  void tearDown(){}

  Future<TrainingProgramInstance> run(TrainingProgramInstance instance){
    int _nextTrainingUnit = 0;

    Future _runNextTrainingUnit(_){
      if(_nextTrainingUnit < trainingUnits.length) {
        TrainingUnit unit = trainingUnits[_nextTrainingUnit++];
        return unit.run(instance).then(_runNextTrainingUnit);
      }

      return new Future.value(instance);
    }

    return _runNextTrainingUnit(null);
  }

}

class FlyTowardsTargetsTrainingProgram extends TrainingProgram {
  final int NUM_TARGETS = 6;
  final double TARGET_DISTANCE = 200.0;
  static final Vector2 trainingCenter = new Vector2(-2700.0,1800.0);
  int LIFETIME_MILLISECONDS = 1000;

  List<Checkpoint> _targets = <Checkpoint>[];


  FlyTowardsTargetsTrainingProgram();

  setUp(){
    for(int i = 0; i < NUM_TARGETS; i++) {
      num angle = (i.toDouble() / NUM_TARGETS.toDouble());
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * TARGET_DISTANCE, Math.sin(angle * Math.PI * 2) * TARGET_DISTANCE);

      Checkpoint checkpoint = new Checkpoint();
      checkpoint.position = position + trainingCenter;
      checkpoint.radius = 30.0;
      checkpoint.orientation = 0.0;
      checkpoint.state = CheckpointState.CLEARED;

      server.world.addEntity(checkpoint);
      _targets.add(checkpoint);
    }

    trainingUnits = new List<TrainingUnit>.generate(_targets.length, (int tuIndex){
      return new FlyTowardsTargetTrainingUnit(trainingCenter,_targets[tuIndex], LIFETIME_MILLISECONDS);
    });

  }

  tearDown(){
    for(Entity entity in _targets){
      server.world.removeEntity(entity);
    }

    _targets.clear();
    trainingUnits.clear();
  }
}

class FlyTowardsTargetTrainingUnit implements TrainingUnit {
  Vector2 spawn;
  Checkpoint target;
  int lifetimeMilliseconds;
  Command _command;

  FlyTowardsTargetTrainingUnit(this.spawn, this.target, this.lifetimeMilliseconds) {
    _command = new FlyTowardsTargetCommand(target);
  }

  Future run(TrainingProgramInstance tpi){

    tpi.client.server.teleportPlayerTo(tpi.client,spawn,0.0,false);

    CommandInstance ci = new CommandInstance();
    ci.client = tpi.client;
    ci.network = tpi.network;
    ci.command = _command;
    tpi.client.currentCommandInstance = ci;

    return new Future.delayed(new Duration(milliseconds: lifetimeMilliseconds)).then((_){
      tpi.client.currentCommandInstance = null;
    });
  }

}