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
import 'package:asteroidracers/shared/shared_client.dart';
import 'package:asteroidracers/services/chat/chat_client.dart';
import "package:asteroidracers/game_server/game_server.dart";

//Views
part "game_renderer.dart";
part 'views/render_helper.dart';
part "views/explosion.dart";
part "views/star_background.dart";
part "views/parallax_layer.dart";
part "views/satellite.dart";
part "views/sun.dart";
part "views/planet.dart";
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
  
  stagexl.RenderLoop renderLoop;
  
  PhysicsSimulator _simulator;

  PlayerController _player;
  PlayerController get player => _player;
  
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>(); //int is the entityId
  ChatController _chat;

  ServerProxy server;
  
  GameRenderer _renderer;
  
  GameClient(this._config) {    
    _simulator = new PhysicsSimulator();  
        
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
  }
  
  
  setup(html.CanvasElement canvas){
    _renderer = new GameRenderer(canvas);
    _renderer.buildUILayer(_onTapConnect);

    renderLoop = new stagexl.RenderLoop();
    renderLoop.addStage(_renderer.stage);
      
    _configureChat();
    
    bool tabHandled = false;
    
    _renderer.stage.onKeyDown.listen((stagexl.KeyboardEvent ke){
      if(!tabHandled && ke.keyCode == html.KeyCode.ONE){
        _renderer.toggleGUI();
        tabHandled = true;
      }
    });

    _renderer.stage.onKeyUp.listen((stagexl.KeyboardEvent ke){
      if(ke.keyCode == html.KeyCode.ONE){
        tabHandled = false;
      }
    });
  }
  
  _configureChat(){
    ChatWindow chatWindow = new ChatWindow();
    _renderer.addWindowToGUI(chatWindow);
    
    _chat = new ChatController(chatWindow.chatInput, chatWindow.chatOutput);
    // send chat messages entered by the player to the server proxy
    _chat.onSendChatMesage.listen(server.send);
    // register the chat controller for chat messages. The server proxy will send them to the chat controller
    server.registerMessageHandler(MessageType.CHAT, _chat.onReceiveMessage);
    // send log messages to onReceiveLogMessage()
    ClientLogger.instance.stdout.listen(_chat.onReceiveLogMessage);
  }
    
  _onTapConnect(_){
    switch(server.state){
        case ServerConnectionState.DISCONNECTED:
          connect();
          break;
        case ServerConnectionState.IS_CONNECTING:
          break;
        case ServerConnectionState.CONNECTED:
          disconnect();
          break;
      }
  }
  
  connect(){
    if(_config.renderBackground){
      _renderer.buildBackgroundLayer();
    }
    
    _renderer.buildEntitiesLayer();    
    renderLoop.juggler.add(this);

    String username = _renderer.username;   
    
    print("connecting...");
    server.connect(_config.localServer, _config.debugJson, username).then(_onConnect).catchError((html.Event e){
      log("could not connect.");
      _onDisconnect();
    });
    
    _renderer.updateConnectButton(server.state); 
    
  }
  
  
  _onConnect(_){
    print("connected");
    _renderer.updateConnectButton(server.state);
  }
  
  disconnect(){
    server.disconnect();
  }
  
  _onDisconnect(){
    _renderer.updateConnectButton(server.state);
    _renderer.stage.juggler.remove(this);
    _renderer.clearScene();
        
    
    if(_player != null){
      renderLoop.juggler.remove(_player);
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

    _renderer.debugOutput = debugOutput;      
    
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
    _player.configureInputControls(_renderer.stage);
    _entityControllers[entity.id] = _player;
    _renderer.addEntityDisplayObject(_player.sprite);
    _renderer.addEntityDisplayObject(_player.particleEmitter);
    
    renderLoop.juggler.add(_player);
    
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

