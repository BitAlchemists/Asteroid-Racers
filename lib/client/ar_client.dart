library ar_client;

import 'dart:html';
import 'dart:math' as Math;
//import 'dart:convert';

import 'package:vector_math/vector_math.dart';
import 'package:game_loop/game_loop_html.dart';

import '../core/ar_client_core.dart';

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

runClient(CanvasElement canvas) {
  GameLoopHtml gameLoop = new GameLoopHtml(canvas);
  
  Scene spaceScene = new SpaceScene(gameLoop);
  Scene menuScene = new MenuScene(gameLoop);
  List scenes = [spaceScene, menuScene];
  
  new ChatController(); //does this get destroyed?
  
  connectionHandler = new ClientConnectionHandler("ws://127.0.0.1:1337/ws");

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