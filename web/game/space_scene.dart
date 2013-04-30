part of asteroidracers;

class SpaceScene extends Scene {
  PhysicsSimulator simulator;
  SceneRenderer renderer;
  
  SpaceScene(GameLoopHtml gameLoop) {
    simulator = new PhysicsSimulator(this);

    addAsteroidBelt(500, 2000, 2000);
    renderer = new SceneRenderer(this, (gameLoop.element as CanvasElement).context2d, gameLoop.width, gameLoop.height);
    
    var player = new Entity("Player", new vec3(0.0, 0.0, 0.0));
    player.addComponent(new GraphicsComponent.triangle());
    PhysicsComponent playerPhysics = new PhysicsComponent();
    player.addComponent(playerPhysics);
    CameraComponent camera = new CameraComponent();
    renderer.camera = camera;
    player.addComponent(camera);
    entities.add(player);
    
    const num rotationSpeed = 1;

    keyDownMap = new Map();
    keyDownMap[KeyCode.LEFT] = (GameLoopHtml gameLoop){
      player.orientation -= gameLoop.dt * rotationSpeed;
    };
    keyDownMap[KeyCode.RIGHT] = (GameLoopHtml gameLoop){
      player.orientation += gameLoop.dt * rotationSpeed;
    };
    keyDownMap[KeyCode.UP] = (GameLoopHtml gameLoop){
      playerPhysics.accelerate();
    };
    keyDownMap[KeyCode.DOWN] = (GameLoopHtml gameLoop){
      playerPhysics.decelerate();
    };
  }

  void addAsteroidBelt(int count, int xDistance, int yDistance) {
    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      //rectangle 
      vec3 point = new vec3(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance, 0.0);
      
      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */
      
      Entity entity = new Entity("asteroid", point);
      entity.addComponent(new GraphicsComponent.asteroid());
      entities.add(entity);
    }
  }

  
  void onUpdate(GameLoopHtml gameLoop) {
    var keys = keyDownMap.keys.where((key) => gameLoop.keyboard.isDown(key));
    
    keys.forEach((key) { 
      keyDownMap[key](gameLoop);
    }); 
    
    simulator.simulate(gameLoop.dt);
  }

  void onRender(GameLoop gameLoop) {
    renderer.render();
  }
}

