part of ar_client;

class SpaceSceneController implements stagexl.Animatable {
  PhysicsSimulator _simulator;
  stagexl.Stage _stage;
  PlayerController _player;
  World _world;
  
  SpaceSceneController(stagexl.Stage stage) {
    _stage = stage;
    _simulator = new PhysicsSimulator();
    _world = new World();
    
    addBackground();
    addPlayer();
    renderEntities();
    
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
    _player = new PlayerController(new Entity(EntityType.SHIP, new Vector2(100.0, 100.0)));
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
  
  void renderEntities() {

    for (Entity entity in _world.entities) {      
      var asteroid = new EntityController(entity);
      RenderHelper.applyAsteroid(asteroid.sprite.graphics);
      _stage.addChild(asteroid.sprite);
    }
  }
}

