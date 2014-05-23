part of web_client;

class GameConfig {
  bool localServer;
  bool debugJson;
}

class GameController implements stagexl.Animatable {
  GameConfig _config;
  PhysicsSimulator _simulator;
  stagexl.Stage _stage;
  PlayerController _player;
  stagexl.Sprite _rootNode;
  html.ButtonElement _connectButton;
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  
  ServerProxy server;
  
  GameController(this._config) {    
    _simulator = new PhysicsSimulator();  
    
    _connectButton = html.querySelector("#connect-button");
    _connectButton.onClick.listen((_)=>_onTapConnect());

    /*
    ChatController chat = new ChatController();
    chat.onSendChatMesage.listen(server.connection.send);
    server.connection.onReceiveMessage.where((Message message) => message.messageType == chat.messageType).listen(chat.onReceiveMessage);
    */
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
  }
  
  setup(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);
    _stage.focus = _stage; 
  }
  
  _onTapConnect(){
    switch(server.state){
        case ServerConnectionState.DISCONNECTED:
          start();
          break;
        case ServerConnectionState.IS_CONNECTING:
          break;
        case ServerConnectionState.CONNECTED:
          stop();
          break;
      }
  }
  
  _updateConnectButton(){
    switch(server.state){
      case ServerConnectionState.DISCONNECTED:
        _connectButton.text = "Connect";
        break;
      case ServerConnectionState.IS_CONNECTING:
        _connectButton.text = "Connecting...";
        break;
      case ServerConnectionState.CONNECTED:
        _connectButton.text = "Disconnect";
        break;
    }
  }
  
  start(){
    _rootNode = new stagexl.Sprite();
    _stage.addChild(_rootNode);
    _stage.juggler.add(this);    
    
    html.InputElement usernameField = html.querySelector("#chat-username");
    String username = usernameField.value;
    
    server.connect(_config.localServer, _config.debugJson, username).then((_){
      _updateConnectButton();
    }).catchError((html.Event e){
      log("could not connect.");
      _onDisconnect();
    });
    
    _updateConnectButton();
  }
  
  stop(){
    server.disconnect();
  }
  
  _onDisconnect(){
    _updateConnectButton();
    _stage.juggler.remove(this);
    
    if(_rootNode != null){
      _rootNode.removeFromParent();
      _rootNode = null;      
    }
    
    _player = null;    
    _simulator.reset();
    
    _entityControllers.clear();
  }
  
  double time = 0.0;
  int ping = 0;
  
  bool advanceTime(num dt){
    
    if(_player != null) {
      Vector2 previousPosition = new Vector2.copy(_player.entity.position);
      double previousOrientation = _player.entity.orientation;
      
      _simulator.simulate(dt);
      
      //if the player position changed...
      if( _player.entity.position.x != previousPosition.x ||
          _player.entity.position.y != previousPosition.y ||
          _player.entity.orientation != previousOrientation)
      {
        _player.updateSprite();
       
        //notify the server
        if(server != null){
          server.send(new Message(MessageType.PLAYER, _player.entity));
        }   
      }
      
      //update the camera
      _rootNode.x = _stage.stageWidth/2.0 -_player.sprite.x;
      _rootNode.y = _stage.stageHeight/2.0 -_player.sprite.y;

    }
    
    time += dt;
    if(time > 5.0){
      time = 0.0;
      log("ping $ping");
      server.send(new Message(MessageType.PING_PONG, ping++));
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

