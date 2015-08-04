part of ai;

class TrainingProgramInstance {
  MajorTom network;
  TrainingProgram program;
  AIClientProxy client;
  List scores = [];
  double get score {
    double finalScore = 0.0;
    for(double score in scores){
      finalScore += score;
    }
    finalScore /= scores.length;
    return finalScore;
  }
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
}

class TrainingProgram {
  List<TrainingUnit> trainingUnits;
  IGameServer server;

  TrainingProgram();
  setUp(){}
  tearDown(){}

  Future<TrainingProgramInstance> run(TrainingProgramInstance instance){
    int _nextTrainingUnit = 0;

    Future _runNextTrainingUnit(_){
      if(_nextTrainingUnit < trainingUnits.length) {
        TrainingUnit unit = trainingUnits[_nextTrainingUnit++];
        return unit.run(instance).then((double score){
          instance.scores.add(score);
          return _runNextTrainingUnit(null);
        });
      }

      return new Future.value(instance);
    }

    return _runNextTrainingUnit(null);
  }

}

