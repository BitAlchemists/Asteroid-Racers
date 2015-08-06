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
    /*
    ai = new DemoDirector("LeastDistanceToTargetsEvaluator", new Vector2(-300.0, 0.0));
    gameServer.registerService(ai);

    ai = new DemoDirector("SumOfDistanceToTargetsEvaluator", new Vector2(300.0, 0.0));
    gameServer.registerService(ai);
*/
    ai = new DemoDirector("TimeToTargetEvaluator", new Vector2(0.0, 0.0));
    gameServer.registerService(ai);
  }

  if(train){
    var targets = CircleTargetGenerator.setupTargets(gameServer);
    Trainer trainer;

    trainer = new Trainer();
    trainer.scriptFactory = (){
      var script = new TargetScript(targets);
      script.evaluator = new TimeToTargetEvaluator();
      return script;
    };
    trainer.folderName = "TimeToTargetEvaluator";
    //trainer.networks = MajorTomSerializer.readNetworksFromFile("LeastDistanceToTargetsEvaluator");
    gameServer.registerService(trainer);

    /*
    trainer = new Trainer();
    trainer.scriptFactory = (){
      var script = new TargetScript(targets);
      script.evaluator = new LeastDistanceToTargetsEvaluator();
      return script;
    };
    trainer.folderName = "LeastDistanceToTargetsEvaluator";
    gameServer.registerService(trainer);


    trainer = new Trainer();
    trainer.scriptFactory = (){
      var script = new TargetScript(targets);
      script.evaluator = new SumOfDistanceToTargetsEvaluator();
      return script;
    };
    trainer.folderName = "SumOfDistanceToTargetsEvaluator";
    gameServer.registerService(trainer);
    */
  }

}