part of web_client;

class GameConfig {
  bool localServer = true;
  bool debugJson = false;
  bool debugCollisions = false; 
  bool fullscreen = false;
}

class GameController implements stagexl.Animatable {
  GameConfig _config;
  PhysicsSimulator _simulator;

  stagexl.Stage _stage;
  StarBackground _background;
  ParallaxLayer _earthLayer;
  stagexl.Sprite _frontLayer;
  stagexl.Sprite _uiLayer;
  
  PlayerController _player;

  //UI
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutput;
  
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  ChatController _chat;
  
  ServerProxy server;
  
  GameController(this._config) {    
    _simulator = new PhysicsSimulator();  
        
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
    
    _configureChat();
     
  }
  
  _configureChat(){
    html.TextAreaElement chatElem = html.querySelector('#chat-display');
    html.InputElement messageElem = html.querySelector('#chat-message');

    _chat = new ChatController(chatElem, messageElem);
    _chat.onSendChatMesage.listen(server.send);
    server.registerMessageHandler(MessageType.CHAT, _chat.onReceiveMessage);
    ClientLogger.instance.stdout.listen(_chat.onReceiveLogMessage);
  }
  
  setup(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    if(_config.fullscreen){
      _stage.scaleMode = stagexl.StageScaleMode.NO_SCALE;
      _stage.align = stagexl.StageAlign.TOP_LEFT;      
    }
    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);
    _stage.focus = _stage;
      
    _buildUILayer();
  }
  
  _buildUILayer(){
    
    num yOffset = 10;
    num xOffset = 10;
    num buttonHeight = 40;
    num boxWidth = 150;
    num contentWidth = boxWidth - 2*xOffset;
    num textFieldHeight = 20;
        
    _uiLayer = new stagexl.Sprite();
    _uiLayer.x = 10;
    _uiLayer.y = 10;
    _stage.addChild(_uiLayer);
    
    num y = yOffset;
    
    stagexl.TextField usernameCaptionField = new stagexl.TextField()
    ..textColor = stagexl.Color.White
    ..x = xOffset
    ..y = y
    ..width = contentWidth
    ..height = textFieldHeight
    ..text = "Username:"
    ..addTo(_uiLayer);
    y = usernameCaptionField.y + usernameCaptionField.height;
    
    _usernameField = new stagexl.TextField()
    ..type = stagexl.TextFieldType.INPUT
    ..backgroundColor = stagexl.Color.White
    ..textColor = stagexl.Color.Black
    ..x = xOffset
    ..y = y
    ..width = contentWidth
    ..height = textFieldHeight
    ..background = true
    ..addTo(_uiLayer);
    _usernameField.onMouseClick.listen((_) => _stage.focus = _usernameField);
    y = _usernameField.y + _usernameField.height + yOffset;
    
    _connectButton = new Button(contentWidth, buttonHeight)
    ..x = xOffset
    ..y = y
    ..text = "Hello World";
    _uiLayer.addChild(_connectButton);
    _connectButton.onMouseClick.listen(_onTapConnect);
    y = _connectButton.y + buttonHeight + yOffset;
    
    _debugOutput = new stagexl.TextField()
    ..textColor = stagexl.Color.White
    ..x = xOffset
    ..y = y
    ..width = contentWidth
    ..height = textFieldHeight * 3
    ..addTo(_uiLayer);
    y = _debugOutput.y + _debugOutput.height + yOffset;
    
    _uiLayer.graphics.rectRound(0, 0, boxWidth, y, 10, 10);
    _uiLayer.graphics.fillColor(0x88888888);
  }
    
  _onTapConnect(_){
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
    //Background
    _background = new StarBackground(2000.0, 2000.0, _stage);
    _stage.addChildAt(_background, 0);  
    _stage.juggler.add(_background);
    
    //Earth layer
    _earthLayer = new ParallaxLayer(_stage, 0.3);
    _stage.addChildAt(_earthLayer, 1);
    _stage.juggler.add(_earthLayer);
    
    Planet earth = new Planet(400, stagexl.Color.DarkBlue, stagexl.Color.Green);
    earth.x = -500;
    _earthLayer.addChild(earth);
    
    Planet moon = new Planet(50, stagexl.Color.LightGray, stagexl.Color.DarkGray);
    moon.x = -100;
    moon.y = -300;
    _earthLayer.addChild(moon);      
    
    Satellite satellite = new Satellite();
    satellite.x = 270;
    satellite.y = 150;
    satellite.rotation = 0.5;
    _earthLayer.addChild(satellite);
    _stage.juggler.add(satellite.juggler);
    
    //Front layer
    _frontLayer = new stagexl.Sprite();
    _stage.addChildAt(_frontLayer, 2);
    _stage.juggler.add(this);    
    
    
    double circleRadius = 100.0;
    
    stagexl.Sprite start;
    start = new stagexl.Sprite();
    start.graphics.circle(0,0,circleRadius);
    start.graphics.fillColor(0x4000ff00);
    
    for(int i = 0; i < 4; i++){
      double angle = Math.PI/2 + Math.PI/3*i;
      Vector2 vec = new Vector2(Math.sin(angle), Math.cos(angle));
      vec *= circleRadius/2;
      stagexl.Sprite start1 = new stagexl.Sprite();
      start1.graphics.circle(vec.x,vec.y,15);
      start1.graphics.fillColor(stagexl.Color.Gray);
      start.addChild(start1);      
    }
    
    
    _frontLayer.addChild(start);

    
    String username = _usernameField.text;   
    
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
    
    if(_frontLayer != null){
      _frontLayer.removeFromParent();
      _frontLayer = null;      
    }
    
    if(_background != null){
      _background.removeFromParent();
      _stage.juggler.remove(_background);
      _background = null;
    }
    
    if(_earthLayer != null){
      _earthLayer.removeFromParent();
      _stage.juggler.remove(_earthLayer);
      _earthLayer = null;
    }
    
    if(_player != null){
      _stage.juggler.remove(_player);
      _player = null;
    }
    
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
        
        
        
        //notify the server
        if(server != null){
          server.send(new Message(MessageType.PLAYER, _player.entity));
        }   
      }
      
      //update the camera
      _frontLayer.x = _stage.stageWidth/2.0 -_player.sprite.x;
      _frontLayer.y = _stage.stageHeight/2.0 -_player.sprite.y;

      debugOutput += "x: ${_player.entity.position.x.toInt()}\ny: ${_player.entity.position.y.toInt()}";
    }
    
    double newFps = updateFps(1/dt);
    debugOutput = "FPS: ${newFps.toInt()}\n$debugOutput";

    _debugOutput.text = debugOutput;      
    
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
    _player = new PlayerController(entity, _stage);
    _frontLayer.addChild(_player.sprite);
    _frontLayer.addChild(_player.particleEmitter);
    _background.player = _player;
    _earthLayer.player = _player;
    _entityControllers[entity.id] = _player;
    _stage.juggler.add(_player);
    
    if(_config.debugCollisions){
      RenderHelper.applyCircle(_player.sprite, entity.radius);
    }

    _simulator.addEntity(_player.entity);
    
    _chat.username = entity.displayName;
  }
  
  void updateEntity(Entity entity) {
    EntityController ec;
    
    if(!_entityControllers.containsKey(entity.id)){
      ec = new EntityController.factory(entity);
      _frontLayer.addChild(ec.sprite);
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
      _frontLayer.removeChild(ec.sprite);
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

