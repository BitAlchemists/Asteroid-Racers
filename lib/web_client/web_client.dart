library web_client;

//Dart
import 'dart:html' as html;
import 'dart:math' as Math;
import "dart:async";

//Packages
import 'package:vector_math/vector_math.dart';
import 'package:stagexl/stagexl.dart' as stagexl;
import "package:stagexl_particle/stagexl_particle.dart" as stagexl_particle;

//Ours
import 'package:asteroidracers/shared/shared.dart';
import 'package:asteroidracers/services/chat/chat_client.dart';
import "package:asteroidracers/game_server/game_server.dart";

//Views
part 'views/render_helper.dart';
part "views/explosion.dart";
part "views/star_background.dart";
part "views/parallax_layer.dart";
part "views/satellite.dart";
part "views/sun.dart";
part "views/planet.dart";
part "views/ui/button.dart";
part "views/ui/window.dart";
part "views/ui/ui_helper.dart";
part "views/station_builder.dart";

//Controllers
part "controllers/entity_controller.dart";
part 'controllers/player_controller.dart';
part "controllers/checkpoint_controller.dart";
part "controllers/race_portal_controller.dart";

part 'physics/physics_simulator.dart';

part 'game_controller.dart';

part 'utils/client_logger.dart';

//server connection
part "net/server_connection.dart";
part "net/local_server_connection.dart";
part 'net/web_socket_server_connection.dart';
part "server_proxy.dart";

  
