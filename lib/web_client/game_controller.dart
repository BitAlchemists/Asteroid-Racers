part of web_client;

class GameConfig {
  bool localServer = true;
  bool debugJson = false;
  bool debugCollisions = false; 
}

class GameController implements stagexl.Animatable {
  GameConfig _config;
  PhysicsSimulator _simulator;

  stagexl.Stage _stage;
  stagexl.Sprite _rootNode;
  StarBackground _background;
  ParallaxLayer _earthLayer;
  
  PlayerController _player;

  html.ButtonElement _connectButton;
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  ChatController _chat;
  html.ParagraphElement _debugOutput;
  
  ServerProxy server;
  
  GameController(this._config) {    
    _simulator = new PhysicsSimulator();  
    
    _connectButton = html.querySelector("#connect-button");
    _connectButton.onClick.listen((_)=>_onTapConnect());
        
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
    
    _chat = new ChatController();
    _chat.onSendChatMesage.listen(server.send);
    server.registerMessageHandler(MessageType.CHAT, _chat.onReceiveMessage);
    ClientLogger.instance.stdout.listen(_chat.onReceiveLogMessage);
    
    _debugOutput = html.querySelector("#debug-output");
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
    _background = new StarBackground(2000.0, 2000.0, _stage);
    _stage.addChild(_background);  
    _stage.juggler.add(_background);
    
    _earthLayer = new ParallaxLayer(_stage, 0.3);
    _stage.addChild(_earthLayer);
    _stage.juggler.add(_earthLayer);
    
    Planet earth = new Planet(400, stagexl.Color.DarkBlue, stagexl.Color.Green);
    earth.x = -500;
    _earthLayer.addChild(earth);
    
    Satellite satellite = new Satellite();
    satellite.x = 270;
    satellite.y = 150;
    satellite.rotation = 0.5;
    _earthLayer.addChild(satellite);
    _stage.juggler.add(satellite.juggler);
    
    _rootNode = new stagexl.Sprite();
    _stage.addChild(_rootNode);
    _stage.juggler.add(this);    
    
    html.InputElement usernameField = html.querySelector("#chat-username");
    String username = usernameField.value;
    
    server.connect(_config.localServer, _config.debugJson, username).then(_onConnect).catchError((html.Event e){
      log("could not connect.");
      _onDisconnect();
    });
    
    _updateConnectButton();
  }
  
  _onConnect(_){
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
    
    if(_background != null){
      _background.removeFromParent();
      _background = null;
    }
    
    _player = null;    
    _simulator.reset();
    
    _entityControllers.clear();
  }
  
  bool advanceTime(num dt){
    
    String debugOutput = ""; 
        
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
        
        debugOutput += "x: ${_player.entity.position.x.toInt()}<br/>y: ${_player.entity.position.y.toInt()}<br/>";
        
        //notify the server
        if(server != null){
          server.send(new Message(MessageType.PLAYER, _player.entity));
        }   
      }
      
      //update the camera
      _rootNode.x = _stage.stageWidth/2.0 -_player.sprite.x;
      _rootNode.y = _stage.stageHeight/2.0 -_player.sprite.y;

    }
    
    double newFps = updateFps(1/dt);
    debugOutput += "FPS: ${newFps.toInt()}";

    _debugOutput.innerHtml = debugOutput;
    
    return true;
  }
  
  double fpsAverage;
  /**
   * Display the animation's FPS in a div.
   */
  double updateFps(num fps) {
    
    if (fpsAverage == null) {
      fpsAverage = fps;
    }

    fpsAverage = fps * 0.05 + fpsAverage * 0.95;
    
    return fpsAverage;
  }
  
    
  void createPlayer(Entity entity){
    _player = new PlayerController(entity);
    _rootNode.addChild(_player.sprite);
    _background.player = _player;
    _earthLayer.player = _player;
    _entityControllers[entity.id] = _player;
    
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
    
    if(_config.debugCollisions){
      RenderHelper.applyCircle(_player.sprite, entity.radius);
    }

    _simulator.addEntity(_player.entity);
    
    _chat.username = entity.displayName;
  }
  
  void updateEntity(Entity entity) {
    EntityController ec;
    
    if(!_entityControllers.containsKey(entity.id)){
      ec = new EntityController(entity);
      _rootNode.addChild(ec.sprite);
      _entityControllers[entity.id] = ec;
      
      if(entity.type == EntityType.SHIP &&
          entity.displayName != null &&
          entity.displayName != ""){
        log("'${entity.displayName}' appearing on our radars.");
      }
      
      if(_config.debugCollisions){
        RenderHelper.applyCircle(ec.sprite, entity.radius);
      }
    }
    else {
      ec = _entityControllers[entity.id];
    }
    
    ec.updateFromServer(entity);    
  }
  
  void removeEntity(int entityId){
    if(_entityControllers.containsKey(entityId))
    {
      EntityController ec = _entityControllers[entityId];
      _rootNode.removeChild(ec.sprite);
      _entityControllers.remove(entityId);
      
      Entity entity = ec.entity;
      
      if(entity.type == EntityType.SHIP &&
          entity.displayName != null &&
          entity.displayName != ""){
        log("'${entity.displayName}' disappeared from our radars.");
      }
    }
  }
  
  handleCollision(int entityId)
  {
    EntityController ec = _entityControllers[entityId];
    ec.entity.canMove = false;
    Explosion.renderExplosion(_stage, ec.sprite, ec.entity.radius);
  }
}

