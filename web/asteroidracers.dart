library asteroidracers;

//import 'package:god_engine/god_engine.dart';
import 'package:game_loop/game_loop_html.dart';

import 'dart:html';

import '../lib/client/chat/chat_client.dart';

import '../lib/client/ar_client.dart';


/**
 * The entry point to the application.
 */
void main() {
  startupChat();
  
  var connectionHandler = new ClientConnectionHandler("ws://127.0.0.1:1337/ws");
  
  CanvasElement canvas = query('#gamecanvas');
  canvas.width = canvas.clientWidth;
  GameLoopHtml gameLoop = new GameLoopHtml(canvas);
  
  Scene spaceScene = new SpaceScene(gameLoop);
  Scene menuScene = new MenuScene(gameLoop);
  List scenes = [spaceScene, menuScene];
  
  gameLoop.onUpdate = (gameLoop) {
    scenes.forEach((Scene scene) => scene.onUpdate(gameLoop));
  };
  
  gameLoop.onRender = (gameLoop) {
    //print('${gameLoop.frame}: ${gameLoop.requestAnimationFrameTime} [dt = ${gameLoop.dt}].');
    scenes.forEach((Scene scene) => scene.onRender(gameLoop));
    showFps(1.0 / gameLoop.dt);
  };
  
  gameLoop.start();
}


double fpsAverage;

/**
 * Display the animation's FPS in a div.
 */
void showFps(num fps) {
  
  if (fpsAverage == null) {
    fpsAverage = fps;
  }

  fpsAverage = fps * 0.05 + fpsAverage * 0.95;

  query("#notes").text = "${fpsAverage.round().toInt()} fps";
}