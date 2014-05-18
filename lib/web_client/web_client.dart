library web_client;

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

//server connection
part "server_connection/connection.dart";
part "server_connection/connection_handler.dart";
part "server_connection/local/local_connection_handler.dart";
part 'server_connection/net/web_socket_connection.dart';

runClient(html.CanvasElement canvas) {
  Renderer renderer = new Renderer(canvas);
  
  ConnectionHandler server;
  var domain = html.document.domain;
  html.Location location = html.window.location;
  var port = 1337;
  var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
  Connection netConnection = new WebSocketConnection(wsPath);
  server = new ConnectionHandler(netConnection);
  
  server.onMessage.listen((Message message){
    log("receiving message ${message.toJson()}");
  });
  
  server.connect().then((_){
    Message message = new Message();
    message.messageType = MessageType.REQUEST_ALL_ENTITIES;
    server.send(message);
  });

  ChatController chat = new ChatController();
  chat.onSendChatMesage.listen(server.send);
  server.onMessage.where((Message message) => message.messageType == chat.messageType).listen(chat.onReceiveMessage);
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