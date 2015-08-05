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
part "trainer.dart";
part "training_program.dart";
part "major_tom.dart";
part "major_tom_serializer.dart";
part "script.dart";

Math.Random random = new Math.Random();