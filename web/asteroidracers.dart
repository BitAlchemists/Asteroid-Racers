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

/**
 * The entry point to the application.
 */
void main() {
  CanvasElement canvas = query('#container');
  canvas.width = canvas.clientWidth;
  
  GameLoop gameLoop = new GameLoop(canvas);
  
  AsteroidsScene scene = new AsteroidsScene(500, 2000, 2000);
  SceneRenderer renderer = new SceneRenderer(scene, canvas.context2d, gameLoop.width, gameLoop.height);
  PhysicsSimulator simulator = new PhysicsSimulator(scene);
  
  var player = new Entity("Player", new vec3(0, 0, 0));
  player.addComponent(new GraphicsComponent.triangle());
  PhysicsComponent playerPhysics = new PhysicsComponent();
  player.addComponent(playerPhysics);
  CameraComponent camera = new CameraComponent();
  renderer.camera = camera;
  player.addComponent(camera);
  scene.entities.add(player);
  
  const num rotationSpeed = 1;

  Map keyDownMap = new Map();
  keyDownMap[GameLoopKeyboard.LEFT] = (GameLoop gameLoop){
    player.orientation -= gameLoop.dt * rotationSpeed;
  };
  keyDownMap[GameLoopKeyboard.RIGHT] = (GameLoop gameLoop){
    player.orientation += gameLoop.dt * rotationSpeed;
  };
  keyDownMap[GameLoopKeyboard.UP] = (GameLoop gameLoop){
    playerPhysics.accelerate();
  };
  keyDownMap[GameLoopKeyboard.DOWN] = (GameLoop gameLoop){
    playerPhysics.decelerate();
  };
  
  gameLoop.onUpdate = (gameLoop) {
    //scene.entities.forEach((Entity entity) => entity.updatePosition());
    var keys = keyDownMap.keys.where((key) => gameLoop.keyboard.isDown(key));
    
    keys.forEach((key) { 
      keyDownMap[key](gameLoop);
    }); 
    
    simulator.simulate(gameLoop.dt);
  };
  
  gameLoop.onRender = (gameLoop) {
    //print('${gameLoop.frame}: ${gameLoop.requestAnimationFrameTime} [dt = ${gameLoop.dt}].');
    renderer.render();
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