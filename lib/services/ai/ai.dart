library ai;

import "dart:async";
import "dart:math" as Math;
import "dart:io";
import "dart:convert";

import "package:neural_network/neural_network.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/shared/shared_client.dart";
import "package:asteroidracers/services/net/local_server_connection.dart";
import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/client/server_proxy.dart";



// Core

part "ai_director.dart";
part "vehicle_control/vehicle_controller.dart";
part "network/major_tom.dart";
part "network/major_tom_serializer.dart";
part "script.dart";
part "evaluator.dart";
part "ai_game_client.dart";

// Directors
part "directors/training_director.dart";
part "directors/demo_director.dart";

// Scripts
part "vehicle_control/race_target_script.dart";
part "vehicle_control/race_target_training_script.dart";
part "vehicle_control/target_vehicle_controller.dart";
part "vehicle_control/target_generator.dart";

Math.Random random = new Math.Random();


//Training config
const int AI_TRAINING_SAMPLE_SIZE = 100;
const int AI_TRAINING_TARGETS = 20;
const int AI_TRAINING_FRAMES = 9000~/15;
const double AI_TRAINING_TARGET_DISTANCE = 1000.0;
const double AI_TRAINING_TARGET_DISTANCE_RANGE = 1000.0;

logging.Logger log = new logging.Logger("services.ai");

registerAITrainingService(IGameServer gameServer){
  log.finest("registerAITrainingService");
  Function networkMutator = (MajorTom network){
    double MUTATION_RATE = 0.1;
    double MUTATION_STRENGTH = 1.0;
    network.mutate(MUTATION_RATE, MUTATION_STRENGTH, MajorTom.mutateConnectionRelative);
  };

  var targets = createTrainingTargets(gameServer);
  AITrainingDirector trainer;

  trainer = new AITrainingDirector();
  trainer.scriptFactory = (network){
    NetworkTrainingScript script = new RespawnTargetTrainingScript(network, targets, new Vector2.zero(), AI_TRAINING_FRAMES);
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
  DemoDirector ai;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator

  ai = new DemoDirector("QuadraticSumOfDistanceToTargets_4_10_8_6_4_2");

  Vector2 center = new Vector2(-300.0,-600.0);
  ai.scriptFactories.add(()=>new RespawnTargetTrainingScript(
      createTrainingTargets(gameServer, center),
      center,
      AI_TRAINING_FRAMES));

  List targets = createDemoRaceTrackTargets(gameServer, new Vector2(0.0,600.0));
  ai.scriptFactories.add((network)=>new RaceTargetTrainingScript(
      network,
      targets,
      targets.first.position,
      36000~/15));

  gameServer.registerService(ai);
}

registerAIRacingService(IGameServer gameServer){
  log.finest("registerAIDemoService");
  var ai;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator

  ai = new DemoDirector("QuadraticSumOfDistanceToTargets_4_10_8_6_4_2");
  ai.scriptFactories.add((network)=>new RaceTargetScript(network));


  gameServer.registerService(ai);
}

List createTrainingTargets(server, [center]){
  if(center == null) center = new Vector2.zero();

  return TargetGenerator.setupFluxCompensatorTargets(
      server,
      center:center);
}

List createDemoRaceTrackTargets(server, [center]){
  if(center == null) center = new Vector2.zero();

  return TargetGenerator.setupDemoRaceTrackTargets(
      server,
      center:center);
}


