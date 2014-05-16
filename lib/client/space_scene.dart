part of ar_client;

class SpaceScene extends stagexl.Sprite {
  PhysicsSimulator simulator;
  
  SpaceScene() {
    
    var player = new RenderChunk.triangle();
    this.addChild(player);

//simulator = new PhysicsSimulator(this);

    addAsteroidBelt(500, 2000, 2000);
    
    
/*    Camera camera = new Camera();
    renderer.camera = camera;
    camera.entity = player; */
    
    const num rotationSpeed = 1;

    /*
    keyDownMap = new Map();
    keyDownMap[KeyCode.LEFT] = (GameLoopHtml gameLoop){
      player.orientation -= gameLoop.dt * rotationSpeed;
    };
    keyDownMap[KeyCode.RIGHT] = (GameLoopHtml gameLoop){
      player.orientation += gameLoop.dt * rotationSpeed;
    };
    keyDownMap[KeyCode.UP] = (GameLoopHtml gameLoop){
      player.accelerate();
    };
    keyDownMap[KeyCode.DOWN] = (GameLoopHtml gameLoop){
      player.decelerate();
    };
    * */
  }

  void addAsteroidBelt(int count, int xDistance, int yDistance) {
    Math.Random random = new Math.Random();

    for (int i = 0; i < count; i++) {
      //rectangle 
      Vector2 point = new Vector2(random.nextDouble() * 2 * xDistance - xDistance, random.nextDouble() * 2 * yDistance - yDistance);
      
      /*
      //circle
      num angle = random.nextDouble() * 2 * Math.PI;
      num radius = random.nextDouble();
      vec3 point = new vec3(radius * xDistance * cos(angle), radius * yDistance * sin(angle), 0);
      */
      
      var entity = new RenderChunk.asteroid();
      entity.x = point.x;
      entity.y = point.y;
      this.addChild(entity);
    }
  }
}

