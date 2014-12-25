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

/**
 * The Game client sets up the game and handles the interaction between player and server
 */
class GameClient implements stagexl.Animatable {
  GameConfig _config;
  
  PhysicsSimulator _simulator;

  PlayerController _player;
  PlayerController get player => _player;
  
  /// a map of entity controllers
  /// 
  /// the int key is the entityId
  final Map<int, EntityController> _entityControllers = new Map<int, EntityController>();
  
  ChatController _chat;

  ServerProxy server;
  
  /// The renderer for displaying the games visual content
  GameRenderer _renderer;
  
  GameClient(this._config) {    
    _simulator = new PhysicsSimulator();  
        
    server = new ServerProxy(this);
    server.onDisconnectDelegate = _onDisconnect;
  }
  
  
  setup(html.CanvasElement canvas){
    _renderer = new GameRenderer(canvas);
    _renderer.buildUILayer(_onTapConnect);

    var renderLoop = new stagexl.RenderLoop();
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
    
    if(_config.renderBackground){
      _renderer.buildBackgroundLayer();
    }
    
    _renderer.buildEntitiesLayer();    
    _renderer.stage.juggler.add(this);
  }
  
  disconnect(){
    server.disconnect();
  }
  
  _onDisconnect(){
    _renderer.updateConnectButton(server.state);
    _renderer.stage.juggler.remove(this);
    _renderer.clearScene();
        
    
    if(_player != null){
      _renderer.stage.juggler.remove(_player);
      _player = null;
    }
    
    _simulator.reset();
    
    _entityControllers.clear();
  }
  
  /// a timer to measure time since last ping
  num time_since_last_ping = 0;
  
  /// bool used to store the acceleration state of the previous frame against
  /// the current frame.
  bool previousAcceleration = false;
  
  bool advanceTime(num dt){
    
    String debugOutput = ""; 
        
    if(_player != null) {      
      double previousOrientation = _player.entity.orientation;
      
      // We allow the rotation to happen locally to give players precise
      // control over their vessels. acceleration is calculated on the server
      // for congruent results over all clients.
      _simulator.simulateRotation(dt);
      
      // if the player position changed...
      if( _player.accelerate != previousAcceleration ||
          _player.entity.orientation != previousOrientation)
      {
        // notify the server
        if(server != null){
          server.send(new Message(MessageType.INPUT, new MovementInput(_player.entity.orientation, _player.accelerate)));
        }   
      }
      
      // store the acceleration state for the next frame
      previousAcceleration = _player.accelerate;
      
      // now simulate the local position
      _simulator.simulateTranslation(dt);
      
      // we always update the sprite because it reduces code paths that need
      // to notify the renderer of position updates (e.g. teleporting)
      _player.updateSprite();
      

      debugOutput += "x: ${_player.entity.position.x.toInt()}\ny: ${_player.entity.position.y.toInt()}\n";
    }
    
    time_since_last_ping += dt;
    if(time_since_last_ping > 0.05){
      time_since_last_ping = 0.0;
      server.ping();
    }
    
    debugOutput += "ping: ${server.pingAverage.toInt()}\n";
    
    double newFps = updateFps(1/dt);
    debugOutput += "FPS: ${newFps.toInt()}\n";

    _renderer.debugOutput = debugOutput;      
    
    return true;
  }
  
  double fpsAverage = null;
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
    _renderer.addEntityFromController(_player);
    _renderer.playerSprite = _player.sprite;
        
    _renderer.stage.juggler.add(_player);
    
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
      _entityControllers[entity.id] = ec;
      _renderer.addEntityFromController(ec);
      
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
      _renderer.removeEntityFromController(ec);
      _entityControllers.remove(entityId);
      
      Entity entity = ec.entity;
      
      if(entity.type == EntityType.SHIP &&
          entity.displayName != null &&
          entity.displayName != ""){
        log("'${entity.displayName}' disappeared from our radars.");
      }
    }
  }
  
  /// handles a collision event for an entity.
  /// 
  /// the entity will be stopped form moving and an explosion sprite will be rendered
  handleCollision(int entityId)
  {
    EntityController ec = _entityControllers[entityId];
    if(ec.entity is Movable){
      (ec.entity as Movable).canMove = false;      
    }
    Explosion.renderExplosion(_renderer.stage, ec.sprite, ec.entity.radius);
  }
}

