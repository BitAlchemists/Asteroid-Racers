library game_client;

//Dart
import 'dart:html' as html;
import 'dart:math' as Math;
import "dart:async";

//Packages
import 'package:vector_math/vector_math.dart';
import 'package:stagexl/stagexl.dart' as stagexl;
import "package:stagexl_particle/stagexl_particle.dart" as stagexl_particle;

//Ours
import 'package:asteroidracers/shared/shared.dart';
import 'package:asteroidracers/services/chat/chat_client.dart';
import "package:asteroidracers/game_server/game_server.dart";

//Views
part 'views/render_helper.dart';
part "views/explosion.dart";
part "views/star_background.dart";
part "views/parallax_layer.dart";
part "views/satellite.dart";
part "views/sun.dart";
part "views/planet.dart";
part "views/ui/button.dart";
part "views/ui/window.dart";
part "views/ui/ui_helper.dart";
part "views/station_builder.dart";

//Controllers
part "controllers/entity_controller.dart";
part 'controllers/player_controller.dart';
part "controllers/checkpoint_controller.dart";
part "controllers/race_portal_controller.dart";

part 'physics/physics_simulator.dart';


part 'utils/client_logger.dart';

//server connection
part "net/server_connection.dart";
part "net/local_server_connection.dart";
part 'net/web_socket_server_connection.dart';
part "server_proxy.dart";

class GameConfig {
  bool localServer = true;
  bool debugJson = false;
  bool debugCollisions = false; 
  bool renderBackground = true;
}

class GameClient implements stagexl.Animatable {
  GameConfig _config;
  PhysicsSimulator _simulator;

  stagexl.Stage _stage;
  StarBackground _background;
  ParallaxLayer _earthLayer;
  ParallaxLayer _entitiesLayer;
  ParallaxLayer _shipsLayer;
  stagexl.Sprite _uiLayer;
  PlayerController _player;
  

  //UI
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutput;
  
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  ChatController _chat;
  
  ServerProxy server;
  
  PlayerController get player => _player;
  stagexl.Stage get stage => _stage;
  Window _debugWindow;
  
  GameClient(this._config) {    
    _simulator = new PhysicsSimulator();  
        
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
    
     
  }
  
  
  setup(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    
    // Fullscreen
    _stage.scaleMode = stagexl.StageScaleMode.NO_SCALE;
    _stage.align = stagexl.StageAlign.TOP_LEFT;      

    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    var renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_stage);
    _stage.focus = _stage;
      
    _buildUILayer();
    _configureChat();
    
    bool tabHandled = false;
    
    _stage.onKeyDown.listen((stagexl.KeyboardEvent ke){
      if(!tabHandled && ke.keyCode == html.KeyCode.ONE){
        _uiLayer.visible = !_uiLayer.visible;
        tabHandled = true;
      }
    });

    _stage.onKeyUp.listen((stagexl.KeyboardEvent ke){
      if(ke.keyCode == html.KeyCode.ONE){
        tabHandled = false;
      }
    });
  }
  
  _configureChat(){
    Window chatWindow = new Window(250);
    chatWindow.x = 10;
    chatWindow.y = _debugWindow.y + _debugWindow.height + 10;
    chatWindow.addTo(_uiLayer);
    
    var chatInput = UIHelper.createInputField();
    chatInput.onMouseClick.listen((_) => _stage.focus = chatInput);
    chatWindow.pushView(chatInput);
    var chatOutput = UIHelper.createTextField(numLines:5);
    chatWindow.pushView(chatOutput);
    
    _chat = new ChatController(chatInput, chatOutput);
    _chat.onSendChatMesage.listen(server.send);
    server.registerMessageHandler(MessageType.CHAT, _chat.onReceiveMessage);
    ClientLogger.instance.stdout.listen(_chat.onReceiveLogMessage);
  }

  
  _buildUILayer(){
    num boxWidth = 150;
    
    _uiLayer = new stagexl.Sprite();
    _uiLayer.addTo(_stage);
        
    // DevWindow
    _debugWindow = new Window(boxWidth);
    _debugWindow.x = 10;
    _debugWindow.y = 10;
    _debugWindow.addTo(_uiLayer);
    
    var usernameCaptionField = UIHelper.createTextField(text: "Username:");
    _debugWindow.pushView(usernameCaptionField);
    
    _usernameField = UIHelper.createInputField();
    _usernameField.onMouseClick.listen((_) => _stage.focus = _usernameField);
    _debugWindow.pushView(_usernameField);
    
    _debugWindow.pushSpace(5);
    
    _connectButton = new Button(_debugWindow.contentWidth, Window.buttonHeight)
    ..text = "Hello World";
    _debugWindow.pushView(_connectButton);
    _connectButton.onMouseClick.listen(_onTapConnect);
    
    _debugWindow.pushSpace(10);
    
    _debugOutput = UIHelper.createTextField(numLines: 3);
    _debugWindow.pushView(_debugOutput);
    
    _debugWindow.pushSpace(10);
   
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
    if(_config.renderBackground){
      _renderBackground();
    }
    
    //Front layer
    _entitiesLayer = new ParallaxLayer(this, 1.0);
    _stage.addChildAt(_entitiesLayer, _stage.numChildren);
    _stage.juggler.add(_entitiesLayer);   
    
    
    _shipsLayer = new ParallaxLayer(this, 1.0);
    _stage.addChildAt(_shipsLayer, _stage.numChildren);
    _stage.juggler.add(_shipsLayer);

    _stage.juggler.add(this);
    
    String username = _usernameField.text;   
    
    print("connecting...");
    server.connect(_config.localServer, _config.debugJson, username).then(_onConnect).catchError((html.Event e){
      log("could not connect.");
      _onDisconnect();
    });
    
    _updateConnectButton(); 
    
    stagexl.Sprite station = StationBuilder.sampleStation();
    station.y = -50;
    station.x = -1200;
    _entitiesLayer.addChild(station);  
    
  }
  
  
  _renderBackground(){
    //Background
    _background = new StarBackground(2000.0, 2000.0, this);
    _stage.addChildAt(_background, _stage.numChildren);  
    _stage.juggler.add(_background);
    
    //Earth layer
    _earthLayer = new ParallaxLayer(this, 0.3);
    _stage.addChildAt(_earthLayer, _stage.numChildren);
    _stage.juggler.add(_earthLayer);
    
    Planet earth = new Planet(400, stagexl.Color.DarkBlue, stagexl.Color.Green);
    earth.x = -700;
    _earthLayer.addChild(earth);
    
    Planet moon = new Planet(50, stagexl.Color.LightGray, stagexl.Color.DarkGray);
    moon.x = -300;
    moon.y = -300;
    _earthLayer.addChild(moon);      
    
    Satellite satellite = new Satellite();
    satellite.x = 270;
    satellite.y = 150;
    satellite.rotation = 0.5;
    _earthLayer.addChild(satellite);
    _stage.juggler.add(satellite.juggler);      
  }
  
  _onConnect(_){
    print("connected");
    _updateConnectButton();
  }
  
  stop(){
    server.disconnect();
  }
  
  _onDisconnect(){
    _updateConnectButton();
    _stage.juggler.remove(this);
    
    if(_entitiesLayer != null){
      _entitiesLayer.removeFromParent();
      _entitiesLayer = null;      
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
    
    if(_shipsLayer != null){
      _shipsLayer.removeFromParent();
      _shipsLayer = null;
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
    _player = new PlayerController(entity);
    _player.configureInputControls(_stage);
    _shipsLayer.addChild(_player.sprite);
    _shipsLayer.addChild(_player.particleEmitter);
    _entityControllers[entity.id] = _player;
    _stage.juggler.add(_player);
    
    if(_config.debugCollisions){
      RenderHelper.applyCircle(_player.sprite, entity.radius);
    }

    _simulator.addMovable(_player.entity);
    
    _chat.username = entity.displayName;
  }
  
  void updateEntity(Entity entity) {
    assert(entity != null);
    
    EntityController ec;
    
    if(!_entityControllers.containsKey(entity.id)){
      ec = new EntityController.factory(entity);
      if(entity.type == EntityType.SHIP){
        _shipsLayer.addChild(ec.sprite); 
      }
      else
      {
        _entitiesLayer.addChild(ec.sprite); 
      }
      
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
      ec.updateFromServer(entity);
    }    
  }
  
  void removeEntity(int entityId){
    if(_entityControllers.containsKey(entityId))
    {
      EntityController ec = _entityControllers[entityId];
      ec.sprite.removeFromParent();
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
    if(ec.entity is Movable){
      (ec.entity as Movable).canMove = false;      
    }
    Explosion.renderExplosion(_stage, ec.sprite, ec.entity.radius);
  }
}

