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

runClient(html.CanvasElement canvas, [bool localServer = true]) {
  bool debug = true;
  
  Renderer renderer = new Renderer(canvas);
  GameController gameController = new GameController(renderer.stage);

  ServerConnection serverConnection;
  
  if(localServer) {
    serverConnection = localConnection(debug);    
  }
  else
  {
    serverConnection = webConnection();  
  }
   
  ServerProxy server = new ServerProxy(serverConnection, gameController);
  gameController.server = server;
  
  ChatController chat = new ChatController();
  chat.onSendChatMesage.listen(serverConnection.send);
  serverConnection.onReceiveMessage.where((Message message) => message.messageType == chat.messageType).listen(chat.onReceiveMessage);
  
  gameController.start();
}

Connection webConnection(){
  ServerConnection server;
  var domain = html.document.domain;
  html.Location location = html.window.location;
  var port = 1337;
  var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
  return new WebSocketServerConnection(wsPath);
}

Connection localConnection(bool debug){
  return new LocalServerConnection(debug);
}

class Renderer {
  stagexl.Stage _stage;
  stagexl.Stage get stage => _stage;
  
  Renderer(html.CanvasElement canvas) {
    _stage = new stagexl.Stage(canvas);
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);
    _stage.focus = _stage;    
  }
}