library asteroidracers;

import 'dart:html';
import 'dart:math' as Math;
import 'package:game_loop/game_loop.dart';
import 'package:vector_math/vector_math.dart';

part 'core/entity.dart';
part 'core/scene.dart';
part 'core/component.dart';

part 'graphics/scene_renderer.dart';
part 'graphics/graphics_component.dart';
part 'graphics/camera_component.dart';

part 'physics/physics_simulator.dart';
part 'physics/physics_component.dart';

part 'game/space_scene.dart';
part 'game/menu/menu_scene.dart';
part 'game/menu/menu_renderer.dart';

/**
 * The entry point to the application.
 */
void main() {
  CanvasElement canvas = query('#container');
  canvas.width = canvas.clientWidth;
  GameLoop gameLoop = new GameLoop(canvas);
  
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