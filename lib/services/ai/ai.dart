library ai;

import "dart:async";
import "dart:math" as Math;
import "dart:io";
import "dart:convert";

import "package:neural_network/neural_network.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net;
import "package:asteroidracers/shared/shared_server.dart";

import "package:logging/logging.dart" as logging;

// Core

part "ai_director.dart";
part "ai_client_proxy.dart";
part "vehicle_controller.dart";
part "major_tom.dart";
part "major_tom_serializer.dart";
part "script.dart";
part "evaluator.dart";

// Directors
part "directors/trainer.dart";
part "directors/demo_director.dart";

// Scripts
part "vehicle_control/target_script.dart";
part "vehicle_control/target_vehicle_controller.dart";

logging.Logger log = new logging.Logger("AI");

Math.Random random = new Math.Random();


//Training config
const int AI_TRAINING_SAMPLE_SIZE = 100;
const int AI_TRAINING_TARGETS = 20;
const int AI_TRAINING_FRAMES = 9000~/15;
const double AI_TRAINING_TARGET_DISTANCE = 1000.0;
const double AI_TRAINING_TARGET_DISTANCE_RANGE = 1000.0;



registerAITrainingService(IGameServer gameServer){
  log.finest("registerAITrainingService");
  Function networkMutator = (MajorTom network){
    double MUTATION_RATE = 0.1;
    double MUTATION_STRENGTH = 1.0;
    network.mutate(MUTATION_RATE, MUTATION_STRENGTH, MajorTom.mutateConnectionRelative);
  };

  var targets = createTrainingTargets(gameServer);
  Trainer trainer;

  trainer = new Trainer();
  trainer.scriptFactory = (){
    var script = new RespawnTargetScript(targets, new Vector2.zero(), AI_TRAINING_FRAMES);
    script.evaluator = new QuadraticSumOfDistanceToTargetsEvaluator();
    return script;
  };
  trainer.networkMutator = networkMutator;
  trainer.networkName = "QuadraticSumOfDistanceToTargets_4_10_8_6_4_2";
  trainer.networkConfiguration = [4,10,8,6,4,2];
  trainer.sampleSize = AI_TRAINING_SAMPLE_SIZE;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator
  gameServer.registerService(trainer);

}

registerAIDemoService(IGameServer gameServer){
  log.finest("registerAIDemoService");
  AIDirector ai;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator
  ai = new DemoDirector("QuadraticSumOfDistanceToTargets_4_10_8_6_4_2", new Vector2(0.0, 0.0), createTrainingTargets);
  gameServer.registerService(ai);

}

List createTrainingTargets(server){
  return CircleTargetGenerator.setupTargets(
      server,
      center:new Vector2.zero());
}

List createDemoTargets(server){
  return CircleTargetGenerator.setupRandomTargets(
      server,
      center:new Vector2.zero(),
      numTargets:AI_TRAINING_TARGETS,
      targetDistance:AI_TRAINING_TARGET_DISTANCE,
      targetDistanceRange:AI_TRAINING_TARGET_DISTANCE_RANGE);
}

