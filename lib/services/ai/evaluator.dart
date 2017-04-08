part of ai;

abstract class Evaluator<S> {
  void evaluate(S script, double dt);
  double get finalScore;
}

class LeastDistanceToTargetsEvaluator extends Evaluator<RaceTargetTrainingScript> {
  Map<Entity, double> scores = new Map<Entity, double>();

  LeastDistanceToTargetsEvaluator();

  void evaluate(RaceTargetTrainingScript script, double dt){
    Entity currentTarget = script.currentTarget;
    double distance = script.client.vehicleController.movable.position.distanceTo(currentTarget.position);

    if(scores[currentTarget] == null){
      scores[currentTarget] = distance;
    }
    else
    {
      scores[currentTarget] = Math.min(distance, scores[currentTarget]);
    }
  }

  double get finalScore {
    double sum = 0.0;
    for(double score in scores.values) sum += score;
    return sum/scores.length;
  }
}

class SumOfDistanceToTargetsEvaluator extends Evaluator<RaceTargetTrainingScript> {
  double finalScore = 0.0;

  SumOfDistanceToTargetsEvaluator();

  void evaluate(RaceTargetTrainingScript script, double dt){
    Entity currentTarget = script.currentTarget;
    finalScore += script.client.vehicleController.movable.position.distanceTo(currentTarget.position) * dt;
  }
}

class QuadraticSumOfDistanceToTargetsEvaluator extends Evaluator<RaceTargetTrainingScript> {
  double finalScore = 0.0;
  double smallestDistance = double.INFINITY;

  QuadraticSumOfDistanceToTargetsEvaluator();

  void evaluate(RaceTargetTrainingScript script, double dt){
    Movable movable = script.client.vehicleController.movable;
    if(movable == null) return;

    Entity currentTarget = script.currentTarget;
    num distance = movable.position.distanceTo(currentTarget.position);

    num score = movable.rotationSpeed.abs();

    //if(distance > currentTarget.radius) {
      score += distance;
      finalScore += score * dt;
    //}
    smallestDistance = distance < smallestDistance ? distance : smallestDistance;
  }
}

class TimeToTargetEvaluator extends Evaluator<RaceTargetTrainingScript> {
  double finalScore = 0.0;

  TimeToTargetEvaluator();

  void evaluate(RaceTargetTrainingScript script, double dt){
    finalScore += dt;
  }

}