part of ai;

class TrainingSet {
  List<TrainingUnit> units;
  Luke brain;

  TrainingSet(this.units, this.brain);

  double get totalReward {
    double result = 0.0;

    for(var unit in this.units){
      result += unit.reward;
    }

    return result;
  }
}

class TrainingUnit {
  Luke brain;
  Checkpoint target;
  AIClientProxy client;
  double reward = 0.0;

  TrainingUnit(this.target, this.brain);
}