part of ar_client;

class SpaceSceneController implements stagexl.Animatable {
  PhysicsSimulator _simulator;
  stagexl.Stage _stage;
  PlayerController _player;
  
  SpaceSceneController(stagexl.Stage stage) {
    _stage = stage;
    _simulator = new PhysicsSimulator();
    addBackground();
    addPlayer();
    addAsteroidBelt(500, 2000, 2000);
    _stage.juggler.add(this);
    
    
/*    Camera camera = new Camera();
    renderer.camera = camera;
    camera.entity = player; */    
  }

  bool advanceTime(num time){
    _simulator.simulate(time);
    _player.updateSprite();
    return true;
  }
  
  void addBackground(){
    var background = new stagexl.Shape();
    background.graphics.rect(0, 0, _stage.contentRectangle.width, _stage.contentRectangle.height);
    background.graphics.fillColor(stagexl.Color.Black);
    _stage.addChild(background);
  }
  
  void addPlayer(){
    _player = new PlayerController(new Vector2(100.0, 100.0));
    _stage.addChild(_player.sprite);
    
    _stage.onKeyDown.listen((stagexl.KeyboardEvent ke){
      switch(ke.keyCode)
      {
        case html.KeyCode.LEFT:
          _player.rotateLeft(); 
          break; 
          
        case html.KeyCode.RIGHT:      
          _player.rotateRight();
          break; 
          
        case html.KeyCode.UP:        
          _player.accelerateForward();
          break; 
          
        case html.KeyCode.DOWN:
          _player.accelerateBackward();
          break;
      }
    });

    _simulator.addEntity(_player.entity);
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
      
      var asteroid = new EntityController(point);
      RenderHelper.applyAsteroid(asteroid.sprite.graphics);
      _stage.addChild(asteroid.sprite);
    }
  }
}

