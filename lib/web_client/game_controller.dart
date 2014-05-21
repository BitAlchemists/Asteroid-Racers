part of web_client;

class GameController implements stagexl.Animatable {
  PhysicsSimulator _simulator;
  stagexl.Stage _stage;
  PlayerController _player;
  World _world;
  stagexl.Sprite _rootNode;
  
  GameController(stagexl.Stage stage) {
    _stage = stage;
    _simulator = new PhysicsSimulator();
    _world = new World();
    
    _rootNode = new stagexl.Sprite();
    _stage.addChild(_rootNode);
    _stage.backgroundColor = stagexl.Color.Black;
    
    _stage.juggler.add(this);    
  }

  bool advanceTime(num time){
    _simulator.simulate(time);
    if(_player != null) {
      _player.updateSprite();
      _rootNode.x = _stage.stageWidth/2.0 -_player.sprite.x;
      _rootNode.y = _stage.stageHeight/2.0 -_player.sprite.y;
    }
    return true;
  }
    
  void createPlayer(Entity entity){
    _player = new PlayerController(entity);
    _rootNode.addChild(_player.sprite);
    
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
  
  void updateEntity(Entity entity) {

    switch(entity.type) {
      case EntityType.ASTEROID:
        var asteroid = new EntityController(entity);
        RenderHelper.applyAsteroid(asteroid.sprite.graphics);
        _rootNode.addChild(asteroid.sprite);        
        break;
    }
  }
}

