library ar_client;

import 'dart:html';
import 'dart:math' as Math;
import "dart:async";
//import 'dart:convert';

import 'package:vector_math/vector_math.dart';
import 'package:game_loop/game_loop_html.dart';

import '../shared/ar_shared.dart';

import '../services/chat/chat_client.dart';


part 'core/entity.dart';
part 'core/scene.dart';

part 'graphics/scene_renderer.dart';
part 'graphics/render_chunk.dart';
part 'graphics/camera.dart';

part 'physics/physics_simulator.dart';

part 'space_scene.dart';
part 'menu/menu_scene.dart';
part 'menu/menu_renderer.dart';

part 'utils/client_logger.dart';
part 'net/client_connection_handler.dart';

runClient(CanvasElement canvas) {
  GameLoopHtml gameLoop = new GameLoopHtml(canvas);
  
  Scene spaceScene = new SpaceScene(gameLoop);
  Scene menuScene = new MenuScene(gameLoop);
  List scenes = [spaceScene, menuScene];

  ClientConnectionHandler connectionHandler;
  connectionHandler = new ClientConnectionHandler("ws://127.0.0.1:1337/ws");

  new ChatController(connectionHandler); //does this get destroyed?

  gameLoop.onUpdate = (gameLoop) {
    scenes.forEach((Scene scene) => scene.onUpdate(gameLoop));
  };
  
  gameLoop.onRender = (gameLoop) {
    //print('${gameLoop.frame}: ${gameLoop.requestAnimationFrameTime} [dt = ${gameLoop.dt}].');
    scenes.forEach((Scene scene) => scene.onRender(gameLoop));
    //showFps(1.0 / gameLoop.dt);
  };
  
  gameLoop.start();
}