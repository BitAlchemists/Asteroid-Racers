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
part 'graphics/camera.dart';

part 'physics/physics_simulator.dart';

part 'space_scene.dart';

part 'utils/client_logger.dart';

//server connection

part "net/local/local_connection.dart";
part 'net/web/web_socket_connection.dart';

runClient(html.CanvasElement canvas) {
  Renderer renderer = new Renderer(canvas);
  
  
  Connection connection = localConnection();
  
  var server = new ConnectionHandler(connection);
  
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

Connection webConnection(){
  ConnectionHandler server;
  var domain = html.document.domain;
  html.Location location = html.window.location;
  var port = 1337;
  var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
  return new WebSocketConnection(wsPath);
}

Connection localConnection(){
  return new LocalConnection();
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