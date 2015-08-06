library ai;

import "dart:async";
import "dart:math" as Math;
import "dart:io";
import "dart:convert";

import "package:neural_network/neural_network.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net;
import "package:asteroidracers/shared/shared_server.dart";

part "ai_director.dart";
part "ai_client_proxy.dart";
part "command.dart";
part "major_tom.dart";
part "major_tom_serializer.dart";
part "script.dart";
part "evaluator.dart";

part "directors/trainer.dart";
part "directors/demo_director.dart";


Math.Random random = new Math.Random();

bool showDemo = false;
bool train = !showDemo;

registerAIServices(IGameServer gameServer){
  if(showDemo){
    AIDirector ai;
    ai = new DemoDirector();
    gameServer.registerService(ai);
  }

  if(train){
    Trainer trainer = new Trainer();
    Vector2 center = new Vector2(-2700.0, 1800.0);
    var targets = CircleTargetGenerator.setupTargets(gameServer, center);
    trainer.scriptFactory = (){
      var script = new TargetScript(center, targets);
      script.evaluator = new LeastDistanceToTargetsEvaluator();
      return script;
    };
    gameServer.registerService(trainer);
  }

}