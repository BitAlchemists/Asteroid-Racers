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
    trainer.scriptFactory = () => new CircleTargetScript();
    trainer.evaluationFunction = (CircleTargetScript script, double previousScore){
      double distance = script.client.movable.position.distanceTo(script.currentTarget.position);
      return previousScore + distance;
    };
    gameServer.registerService(trainer);
  }

}