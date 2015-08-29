library game_client;

//Dart
import 'dart:html' as html;
import 'dart:math' as Math;

//Packages
import 'package:vector_math/vector_math.dart';
import 'package:stagexl/stagexl.dart' as stagexl;
import "package:stagexl_particle/stagexl_particle.dart" as stagexl_particle;
import 'utils/client_logger.dart';

//Ours
import 'package:asteroidracers/shared/ui.dart';
import 'package:asteroidracers/services/chat/chat_client.dart';
import "package:asteroidracers/shared/net.dart" as net; //todo: remove this and layer all its code out to serverproxy
import "package:asteroidracers/game_client/server_proxy.dart";
import "package:asteroidracers/shared/shared_client.dart";

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

Math.Random random = new Math.Random();

class GameConfig {
  bool localServer = true;
  bool debugLocalServerNetEncoding = false;
  bool debugCollisions = false; 
  bool renderBackground = true;
}

/**
 * The Game client sets up the game and handles the interaction between player and server
 */
class GameClient implements stagexl.Animatable, IGameClient {
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
    server.registerMessageHandler(net.MessageType.CHAT, _chat.onReceiveMessage);
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
    server.connect(_config.localServer, _config.debugLocalServerNetEncoding, username).then(_onConnect).catchError((html.Event e){
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

    //change the render order to prevent multiplayer spaceship jitter
    _renderer.stage.juggler.remove(_renderer);
    _renderer.stage.juggler.add(_renderer);
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
  double previousAcceleration = 0.0;
  double previousRotation = 0.0;

  bool advanceTime(num dt){
    String debugOutput = "";
        
    if(_player != null) {      
      double previousOrientation = _player.entity.orientation;
      
      // We allow the rotation to happen locally to give players precise
      // control over their vessels. acceleration is calculated on the server
      // for congruent results over all clients.
      _simulator.simulateRotation(dt);
      
      // if the player position changed...
      if( _player.accelerationFactor != previousAcceleration ||
          _player.entity.orientation != previousOrientation ||
          _player._movable.rotationSpeed != previousRotation)
      {
        // notify the server
        if(server != null){

          //TODO: move this code to ServerProxy
          net.MovementInput movementInput = new net.MovementInput();
          movementInput.accelerationFactor = _player.accelerationFactor;
          movementInput.newOrientation = _player.entity.orientation;
          movementInput.rotationSpeed = _player._movable.rotationSpeed;

          net.Envelope envelope = new net.Envelope();
          envelope.messageType = net.MessageType.INPUT;
          envelope.payload = movementInput.writeToBuffer();

          server.send(envelope);
        }   
      }
      
      // store the acceleration state for the next frame
      previousAcceleration = _player.accelerationFactor;
      previousRotation = _player._movable.rotationSpeed;
      
      // now simulate the local position
      _simulator.simulateTranslation(dt);
      
      // we always update the sprite because it reduces code paths that need
      // to notify the renderer of position updates (e.g. teleporting)
      _renderer.updateSpriteInNextFrame(_player);

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
    _player.isLocalPlayer = true;
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
      bool updateSprite = ec.updateFromServer(entity);
      if(updateSprite){
        _renderer.updateSpriteInNextFrame(ec);
      }
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

    if(ec == null) {
      print("cannot handle collision: entity controller for entity with id $entityId not found");
      return;
    }

    if(ec.entity is Movable){
      (ec.entity as Movable).canMove = false;      
    }
    Explosion.renderExplosion(_renderer.stage, ec.sprite, ec.entity.radius);
  }
}

