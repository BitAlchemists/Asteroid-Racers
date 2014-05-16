library ar_client;

import 'dart:html' as html;
import 'dart:math' as Math;
import "dart:async";
//import 'dart:convert';

import 'package:vector_math/vector_math.dart';
import '../shared/ar_shared.dart';
import '../services/chat/chat_client.dart';
import 'package:stagexl/stagexl.dart' as stagexl;

part "core/entity_controller.dart";
part 'core/player_controller.dart';

part 'core/render_helper.dart';
part 'graphics/camera.dart';

part 'physics/physics_simulator.dart';

part 'space_scene.dart';

part 'utils/client_logger.dart';
part 'net/client_connection_handler.dart';

runClient(html.CanvasElement canvas) {
  Renderer renderer = new Renderer(canvas);
  
  ClientConnectionHandler server;
  var domain = html.document.domain;
  html.Location location = html.window.location;
  var port = 1337;
  var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
  server = new ClientConnectionHandler(wsPath);

  new ChatController(server);
  
  Message message = new Message();
  message.messageType = MessageType.REQUEST_ALL_ENTITIES;
  server.send(message);
}

class Renderer {
  stagexl.Stage _stage;
  
  Renderer(html.CanvasElement canvas) {
    _stage = new stagexl.Stage(canvas);
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);
    _stage.focus = _stage;
    
    var spaceScene = new SpaceSceneController(_stage);
  }
}