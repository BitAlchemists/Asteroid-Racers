library asteroidracers;

import 'dart:html';
import 'dart:math';
import 'package:game_loop/game_loop.dart';
import 'package:vector_math/vector_math.dart';

part 'core/entity.dart';
part 'core/scene.dart';
part 'core/component.dart';

part 'graphics/scene_renderer.dart';
part 'graphics/render_component.dart';

/**
 * The entry point to the application.
 */
void main() {
  CanvasElement canvas = query('#container');
  canvas.width = canvas.clientWidth;
  GameLoop gameLoop = new GameLoop(canvas);
  
  AsteroidsScene scene = new AsteroidsScene();
  SceneRenderer renderer = new SceneRenderer(scene, canvas.context2d, gameLoop.width, gameLoop.height);
  
  var player = new Entity("Player", new vec3(0, 0, 0));
  player.addComponent(new RenderComponent());
  scene.entities.add(player);
  
  const num rotationSpeed = 1;
  const num playerSpeed = 10;

  Map keyDownMap = new Map();
  keyDownMap[GameLoopKeyboard.LEFT] = (GameLoop gameLoop){
    player.orientation -= gameLoop.dt * rotationSpeed;
  };
  keyDownMap[GameLoopKeyboard.RIGHT] = (GameLoop gameLoop){
    player.orientation += gameLoop.dt * rotationSpeed;
  };
  keyDownMap[GameLoopKeyboard.UP] = (GameLoop gameLoop){
    player.position.y -= gameLoop.dt * playerSpeed;
  };
  keyDownMap[GameLoopKeyboard.DOWN] = (GameLoop gameLoop){
    player.position.y += gameLoop.dt * playerSpeed;
  };
  
  gameLoop.onUpdate = (gameLoop) {
    //scene.entities.forEach((Entity entity) => entity.updatePosition());
    var keys = keyDownMap.keys.where((key) => gameLoop.keyboard.isDown(key));
    
    keys.forEach((key) { 
      keyDownMap[key](gameLoop);
    }); 
  };
  
  gameLoop.onRender = (gameLoop) {
    //print('${gameLoop.frame}: ${gameLoop.requestAnimationFrameTime} [dt = ${gameLoop.dt}].');
    renderer.render();
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