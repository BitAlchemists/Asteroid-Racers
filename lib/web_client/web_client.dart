library web_client;

//Dart
import 'dart:html' as html;
import 'dart:math' as Math;
import "dart:async";

//Packages
import 'package:vector_math/vector_math.dart';
import 'package:stagexl/stagexl.dart' as stagexl;

//Ours
import '../shared/ar_shared.dart';
import '../services/chat/chat_client.dart';
import "../world_server/world_server.dart";


part "core/entity_controller.dart";
part 'core/player_controller.dart';

part 'core/render_helper.dart';

part 'physics/physics_simulator.dart';

part 'game_controller.dart';

part 'utils/client_logger.dart';

//server connection
part "net/server_connection.dart";
part "net/local_server_connection.dart";
part 'net/web_socket_server_connection.dart';
part "server_proxy.dart";

  
