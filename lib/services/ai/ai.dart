library ai;

import "dart:async";
import "dart:math" as Math;
import "dart:io";
import "dart:convert";
import "dart:isolate";

import "package:neural_network/neural_network.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net;
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/shared/shared_client.dart";
import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/services/net/local_server_connection.dart";
import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/client/server_proxy.dart";


import "package:logging/logging.dart" as logging;

// Core

part "ai_director.dart";
part "package:asteroidracers/services/ai/vehicle_control/vehicle_controller.dart";
part "major_tom.dart";
part "major_tom_serializer.dart";
part "script.dart";
part "evaluator.dart";
part "ai_game_client.dart";

// Directors
part "directors/training_director.dart";
part "directors/demo_director.dart";

// Scripts
part "vehicle_control/target_script.dart";
part "vehicle_control/target_vehicle_controller.dart";
part "vehicle_control/target_generator.dart";


Math.Random random = new Math.Random();


//Training config
//const String AI_TRAINING_DB_NAME = "QuadraticSumOfDistanceToTargets_4_10_8_6_4_2";
//const List AI_TRAINING_NETWORK = const [4,10,8,6,4,2];

const String AI_TRAINING_DB_NAME = "QuadraticSumOfDistanceToTargets_4_4_4_2";
const List AI_TRAINING_NETWORK = const [4,4,4,2];


const int AI_TRAINING_SAMPLE_SIZE = 10;
const double AI_TRAINING_SURVIVAL_RATE = 0.1;
const int AI_TRAINING_TARGETS = 3;
const int AI_TRAINING_FRAMES = 9000~/15;
const double AI_TRAINING_TARGET_DISTANCE = 1000.0;
const double AI_TRAINING_TARGET_DISTANCE_RANGE = 200.0;



registerAITrainingService(IGameServer gameServer){
  logging.Logger log = new logging.Logger("ai");
  log.finest("registerAITrainingService");
  Function networkMutator = (MajorTom network){
    double MUTATION_RATE = 0.1;
    double MUTATION_STRENGTH = 1.0;
    network.mutate(MUTATION_RATE, MUTATION_STRENGTH, MajorTom.mutateConnectionRelative);
  };

  var targets = createTrainingTargets(gameServer);
  AITrainingDirector trainer;

  trainer = new AITrainingDirector();
  trainer.scriptFactory = (){
    var script = new RespawnTargetTrainingScript(targets, new Vector2.zero(), AI_TRAINING_FRAMES);
    script.evaluator = new QuadraticSumOfDistanceToTargetsEvaluator();
    return script;
  };
  trainer.networkMutator = networkMutator;
  trainer.networkName = AI_TRAINING_DB_NAME;
  trainer.networkConfiguration = AI_TRAINING_NETWORK;
  trainer.sampleSize = AI_TRAINING_SAMPLE_SIZE;
  trainer.survivalRate = AI_TRAINING_SURVIVAL_RATE;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator
  gameServer.registerService(trainer);

}

registerAIDemoService(IGameServer gameServer){
  logging.Logger log = new logging.Logger("ai");
  log.finest("registerAIDemoService");
  AIDemoDirector ai;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator

  ai = new AIDemoDirector(AI_TRAINING_DB_NAME, "Demo");

  Vector2 center = new Vector2(-300.0,-600.0);
  ai.scriptFactories.add(()=>new RespawnTargetTrainingScript(
      createTrainingTargets(gameServer, center),
      center,
      AI_TRAINING_FRAMES));

  List targets = createDemoRaceTrackTargets(gameServer, new Vector2(0.0,600.0));
  ai.scriptFactories.add(()=>new RaceTargetTrainingScript(
      targets,
      targets.first.position,
      36000~/15));

  gameServer.registerService(ai);
}

registerAIRacingService(IGameServer gameServer){
  logging.Logger log = new logging.Logger("ai");
  log.finest("registerAIDemoService");
  var ai;
  // LeastDistanceToTargetsEvaluator
  // SumOfDistanceToTargetsEvaluator
  // TimeToTargetEvaluator

  ai = new AIDemoDirector(AI_TRAINING_DB_NAME, "Demo");
  ai.scriptFactories.add(()=>new RaceTargetScript());


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


