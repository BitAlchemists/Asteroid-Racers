part of web_client;

class GameController implements stagexl.Animatable {
  PhysicsSimulator _simulator;
  final stagexl.Stage _stage;
  PlayerController _player;
  final stagexl.Sprite _rootNode = new stagexl.Sprite();
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  
  ServerProxy server;
  
  GameController(this._stage) {
    _stage.addChild(_rootNode);
    _stage.backgroundColor = stagexl.Color.Black;
    
    _simulator = new PhysicsSimulator();
    
    _stage.juggler.add(this);    
  }
  
  start(){
    html.InputElement usernameField = html.querySelector("#chat-username");
    String username = usernameField.text;
    if(username == null || username == ""){
      username = "Bernd";
    }
    
    server.connect(username);
  }

  bool advanceTime(num time){
    _simulator.simulate(time);
    if(_player != null) {
      _player.updateSprite();
      _rootNode.x = _stage.stageWidth/2.0 -_player.sprite.x;
      _rootNode.y = _stage.stageHeight/2.0 -_player.sprite.y;
      
      if(server != null){
        server.send(new Message(MessageType.PLAYER, _player.entity));
      }
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
    EntityController ec;
    
    if(!_entityControllers.containsKey(entity.id)){
      ec = new EntityController(entity);
      _rootNode.addChild(ec.sprite);
      _entityControllers[entity.id] = ec; 
    }
    else {
      ec = _entityControllers[entity.id];
    }
    
    ec.entity.copyFrom(entity);
    
    ec.updateSprite();
  }
  
  void removeEntity(int entityId){
    if(_entityControllers.containsKey(entityId))
    {
      EntityController ec = _entityControllers[entityId];
      _rootNode.removeChild(ec.sprite);
      _entityControllers.remove(entityId);
    }
  }
}

