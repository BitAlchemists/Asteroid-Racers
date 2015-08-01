library ai;

import "dart:async";
import "dart:math" as Math;
import "dart:io";
import "dart:convert";

import "package:neural_network/neural_network.dart";

import "package:asteroidracers/shared/world.dart";
import "package:asteroidracers/shared/net.dart" as net;
import "package:asteroidracers/shared/shared_server.dart";

part "luke_controller.dart";
part "ai_director.dart";
part "luke.dart";
part "training_set.dart";
part "luke_serializer.dart";

Math.Random random = new Math.Random();