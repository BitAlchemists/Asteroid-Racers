library ar_client;

import 'dart:html';
import 'dart:math' as Math;
import "dart:async";
//import 'dart:convert';

import 'package:vector_math/vector_math.dart';
import '../shared/ar_shared.dart';
import '../services/chat/chat_client.dart';
import 'package:stagexl/stagexl.dart' as stagexl;


part 'core/entity.dart';

part 'graphics/scene_renderer.dart';
part 'graphics/render_chunk.dart';
part 'graphics/camera.dart';

part 'physics/physics_simulator.dart';

part 'space_scene.dart';

part 'utils/client_logger.dart';
part 'net/client_connection_handler.dart';

runClient(CanvasElement canvas) {
  Renderer renderer = new Renderer(canvas);
  
/*  Scene spaceScene = new SpaceScene(gameLoop);
  Scene menuScene = new MenuScene(gameLoop);
  List scenes = [spaceScene, menuScene];
*/
  ClientConnectionHandler connectionHandler;
  connectionHandler = new ClientConnectionHandler("ws://127.0.0.1:1337/ws");

  new ChatController(connectionHandler);
}

class Renderer {
  stagexl.Stage _stage;
  
  Renderer(CanvasElement canvas) {
    _stage = new stagexl.Stage(canvas);
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);

    var background = new stagexl.Shape();
    background.graphics.rect(0, 0, canvas.clientWidth, canvas.clientHeight);
    background.graphics.fillColor(stagexl.Color.Black);
    _stage.addChild(background);
    
    _stage.addChild(new SpaceScene());
  }
}