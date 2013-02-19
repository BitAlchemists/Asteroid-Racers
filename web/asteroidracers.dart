library asteroidracers;

import 'dart:html';
import 'dart:math';
import 'package:game_loop/game_loop.dart';

part 'entity.dart';
part 'scene.dart';
part 'scene_renderer.dart';

/**
 * The entry point to the application.
 */
void main() {
  CanvasElement canvas = query('#container');
  canvas.width = canvas.clientWidth;
  GameLoop gameLoop = new GameLoop(canvas);
  
  AsteroidsScene scene = new AsteroidsScene();
  SceneRenderer renderer = new SceneRenderer(scene, canvas.context2d, gameLoop.width, gameLoop.height);
  
  var player = new Entity("Sun", 10, new Point(0,0), new Vector(0,0));
  scene.entities.add(player);
  
  const num playerSpeed = 10;

  Map keyDownMap = new Map();
  keyDownMap[GameLoopKeyboard.LEFT] = (gameLoop){
    player.speed.x -= gameLoop.dt * playerSpeed;
  };
  keyDownMap[GameLoopKeyboard.RIGHT] = (gameLoop){
    player.speed.x += gameLoop.dt * playerSpeed;
  };
  keyDownMap[GameLoopKeyboard.UP] = (gameLoop){
    player.speed.y -= gameLoop.dt * playerSpeed;
  };
  keyDownMap[GameLoopKeyboard.DOWN] = (gameLoop){
    player.speed.y += gameLoop.dt * playerSpeed;
  };
  
  gameLoop.onUpdate = (gameLoop) {
    scene.movables.forEach((Movable movable) => movable.updatePosition());
    var keys = keyDownMap.keys.where((key) => gameLoop.keyboard.isDown(key));
    
    keys.forEach((key) { 
      Function function = keyDownMap[key];
      function(gameLoop);
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

class Point {
  num x, y;

  Point([this.x, this.y]);
}

class Vector {
  num x, y;
  Vector(this.x, this.y);
}

