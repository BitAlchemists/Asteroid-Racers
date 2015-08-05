part of ai;

class TrainingProgramInstance {
  MajorTom network;
  TrainingProgram program;
  AIClientProxy client;

  TrainingUnit currentTrainingUnit;
  int framesInTrainingUnit;
  Completer completer;

  void updateScore(Command command)
  {
    currentTrainingUnit.updateScore(this);
  }

  double score = 0.0;
  double get highscore => score;

  TrainingProgramInstance(this.program, this.network);

  updateHighscore(){

    //highscore = betterReward(score, highscore);
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
  void step(TrainingProgramInstance instance, double dt);
  double updateScore(TrainingProgramInstance instance);
}

class TrainingProgram {
  List<TrainingUnit> trainingUnits = <TrainingUnit>[];
  IGameServer server;

  TrainingProgram();
  setUp(){}
  tearDown(){}

  Future<TrainingProgramInstance> run(TrainingProgramInstance instance){
    int _nextTrainingUnit = 0;

    _runNextTrainingUnit(_){
      if(_nextTrainingUnit < trainingUnits.length) {
        TrainingUnit unit = trainingUnits[_nextTrainingUnit++];
        instance.currentTrainingUnit = unit;
        instance.framesInTrainingUnit = 0;
        //print("running next training unit");
        return unit.run(instance).then((_){
          //print("training unit finished");
          instance.currentTrainingUnit = null;
          return _runNextTrainingUnit(null);
        });
      }

      return instance;
    }

    return _runNextTrainingUnit(null);
  }

}

