part of ai;

abstract class Evaluator<S> {
  void evaluate(S script, double dt);
  double get finalScore;
}

class LeastDistanceToTargetsEvaluator extends Evaluator<RaceTargetScript> {
  Map<Entity, double> scores = new Map<Entity, double>();

  LeastDistanceToTargetsEvaluator();

  void evaluate(RaceTargetScript script, double dt){
    Entity currentTarget = script.currentTarget;
    double distance = script.client.movable.position.distanceTo(currentTarget.position);

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

class SumOfDistanceToTargetsEvaluator extends Evaluator<RaceTargetScript> {
  double finalScore = 0.0;

  SumOfDistanceToTargetsEvaluator();

  void evaluate(RaceTargetScript script, double dt){
    Entity currentTarget = script.currentTarget;
    finalScore += script.client.movable.position.distanceTo(currentTarget.position) * dt;
  }
}

class QuadraticSumOfDistanceToTargetsEvaluator extends Evaluator<RaceTargetScript> {
  double finalScore = 0.0;

  QuadraticSumOfDistanceToTargetsEvaluator();

  void evaluate(RaceTargetScript script, double dt){
    Entity currentTarget = script.currentTarget;
    num sumOfDistanceToTargets = script.client.movable.position.distanceTo(currentTarget.position);
    num score = sumOfDistanceToTargets + script.client.movable.rotationSpeed.abs();
    finalScore += score * dt;
  }
}

class TimeToTargetEvaluator extends Evaluator<RaceTargetScript> {
  double finalScore = 0.0;

  TimeToTargetEvaluator();

  void evaluate(RaceTargetScript script, double dt){
    finalScore += dt;
  }

}