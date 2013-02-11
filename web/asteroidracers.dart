library asteroidracers;

import 'dart:html';
import 'dart:math';
import 'package:game_loop/game_loop.dart';

part 'movable.dart';

/**
 * The entry point to the application.
 */
void main() {
  CanvasElement canvas = query('#container');
  canvas.width = canvas.clientWidth;
  GameLoop gameLoop = new GameLoop(canvas);
  
  AsteroidsScene scene = new AsteroidsScene();
  SceneRenderer renderer = new SceneRenderer(scene, canvas.context2d, gameLoop.width, gameLoop.height);
  
  var player = new Movable("Sun", "#ff2", 10, new Point(0,0), new Vector(0,0));
  scene.movables.add(player);
  
  const num playerSpeed = 30;

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

  Point(this.x, this.y);
}

class Vector {
  num x, y;
  Vector(this.x, this.y);
}


class Scene {
  List<Movable> movables = new List<Movable>();
}

class AsteroidsScene extends Scene {

  AsteroidsScene() {
    addAsteroidBelt(30); 
  }

  void addAsteroidBelt(int count) {
    Random random = new Random();

    for (int i = 0; i < count; i++) {
      int xDistance = 500;
      int yDistance = 200;
      Point point = new Point(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance);
      movables.add(new Movable("asteroid", "#777", 3, point, new Vector(0,0)));
    }
  }

  
/*
  num normalizePlanetSize(num r) {
    return log(r + 1) * (width / 100.0);
  }
  */
}

class SceneRenderer {
  num width;
  num height;
  CanvasRenderingContext2D context;
  Scene scene;
  
  SceneRenderer(this.scene, this.context, this.width, this.height);
  
   void render()
   {
     drawBackground();
     drawMovables();
   }
   
   void drawBackground() {
     context.fillStyle = "black";
     context.rect(0, 0, width, height);
     context.fill();
   }

   void drawMovables() {
     scene.movables.forEach( 
         (Movable movable) => movable.draw(context, width / 2, height / 2) 
     );
   }
}
