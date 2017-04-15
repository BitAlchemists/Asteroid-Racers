library game_client_net;

import "dart:async";

import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/world.dart" as world;
import 'package:asteroidracers/shared/shared_client.dart';
import "package:asteroidracers/services/net/server_connection.dart";

typedef void MessageHandler(Envelope envelope);

class ServerConnectionState {
  static const int DISCONNECTED = 0;
  static const int IS_CONNECTING = 1;
  static const int CONNECTED = 2; 
}

class ServerProxy {
  logging.Logger _log = new logging.Logger("BaseClient.Net.ServerProxy");
  ServerConnection _serverConnection;
  IGameClient _gameClient;
  Map<String, MessageHandler> _messageHandlers;
  Function onDisconnectDelegate;
  int _state = ServerConnectionState.DISCONNECTED;
  
  int get state => _state;
  ServerConnection get connection => _serverConnection;
  StreamSubscription _onReceiveMessageStreamSubscription;
  
  ServerProxy(this._gameClient)
  {
    _log.fine("ServerProxy");
    _messageHandlers = 
      {
        MessageType.ENTITY.name: this._onEntityUpdate,
        MessageType.ENTITY_REMOVE.name: this._onEntityRemove,
        MessageType.PLAYER.name: this._onPlayer,
        MessageType.PING_PONG.name: this._onPingPong,
        MessageType.COLLISION.name: this._onCollision,
        MessageType.RACE_JOIN.name: this._onRaceJoin,
        MessageType.RACE_EVENT.name: this._onRaceEvent,
        MessageType.RACE_LEAVE.name: this._onRaceLeave
      };
  }

  destructor(){
    _log.fine("destructor()");
    _messageHandlers = null;
    _gameClient = null;
  }
  
  registerMessageHandler(MessageType messageType, MessageHandler messageHandler)
  {
    _messageHandlers[messageType.name] = messageHandler;
  }
  
  Future connect(ServerConnection serverConnection, String desiredUsername)
  {
    _log.fine("connect()");
    _serverConnection = serverConnection;

    _serverConnection.onDisconnectDelegate = _onDisconnect;
    _onReceiveMessageStreamSubscription = _serverConnection.onReceiveMessage.listen(_onReceiveMessage);
    
    _state = ServerConnectionState.IS_CONNECTING;
    return _serverConnection.connect().then((_){
      _state = ServerConnectionState.CONNECTED;

      Handshake handshake = new Handshake();
      handshake.username = desiredUsername;

      Envelope envelope = new Envelope();
      envelope.messageType = MessageType.HANDSHAKE;
      envelope.payload = handshake.writeToBuffer();
      _serverConnection.send(envelope);
    });
  }
  
  disconnect()
  {
    _log.fine("disconnect()");
    _serverConnection.disconnect();
    _serverConnection = null;
  }
  
  _onDisconnect()
  {
    _log.fine("_onDisconnect()");
    _state = ServerConnectionState.DISCONNECTED;
    this.onDisconnectDelegate();
    _onReceiveMessageStreamSubscription.cancel();
    _onReceiveMessageStreamSubscription = null;
    _serverConnection.onDisconnectDelegate = null;
    _serverConnection = null;
  }
  
  send(Envelope envelope)
  {
    _serverConnection.send(envelope);
  }
  
  _onReceiveMessage(Envelope envelope) 
  {
    try {      
      if(envelope.messageType == null)
      {
        _log.warning("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[envelope.messageType.name];

      // log the message type
      if(_log.level <= logging.Level.INFO){
        var excludedMessageTypes = [MessageType.PING_PONG, MessageType.ENTITY];
        // only log packets that are not within the list of excluded message types
        if(!excludedMessageTypes.contains(envelope.messageType)){
          _log.fine("receiving message type ${envelope.messageType.name}");
        }
      }

      // handle the message
      if(messageHandler != null){
        messageHandler(envelope);
      }
      else {
        _log.warning("no appropriate message handler for messageType ${envelope.messageType.name} found.");
      }            
    }
    catch (e, stack)
    {
      _log.severe("exception during ServerProxy.onMessage: ${e.toString()}\nStack:\n$stack");
      if(envelope.messageType != null){
        _log.severe("affected message type: ${envelope.messageType}");
      }
    }
  }
  
  _onEntityRemove(Envelope envelope)
  {
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    _gameClient.removeEntity(message.integer);
  }

  _onEntityUpdate(Envelope envelope)
  {
    Entity netEntity = new Entity.fromBuffer(envelope.payload);
    world.Entity worldEntity = EntityMarshal.netEntityToWorldEntity(netEntity);
    _gameClient.updateEntity(worldEntity);
  }
  
  _onPlayer(Envelope envelope)
  {
    Entity entity = new Entity.fromBuffer(envelope.payload);
    world.Movable movable = EntityMarshal.netEntityToWorldEntity(entity);
    _gameClient.createPlayer(movable);
  }

  //we calculate our time in relation to the server start time
  int serverStartTime = new DateTime.now().millisecondsSinceEpoch;
  double pingAverage = 0.0;

  ping(){
    IntMessage message = new IntMessage();
    message.integer = new DateTime.now().millisecondsSinceEpoch - serverStartTime;

    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.PING_PONG;
    envelope.payload = message.writeToBuffer();
    send(envelope);
  }

  _onPingPong(Envelope envelope){
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    int ms = message.integer;
    int now = new DateTime.now().millisecondsSinceEpoch - serverStartTime;
    int ping = now - ms;
    
    if (pingAverage == null) {
      pingAverage = ping.toDouble();
    }

    pingAverage = ping * 0.05 + pingAverage * 0.95;
  }
  
  _onCollision(Envelope envelope){
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    _gameClient.handleCollision(message.integer);
  }

  _onRaceJoin(Envelope envelope){
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    _gameClient.joinRace(message.integer);
  }

  _onRaceEvent(Envelope envelope){
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    _gameClient.activateNextCheckpoint(message.integer);
  }

  _onRaceLeave(Envelope envelope){
    IntMessage message = new IntMessage.fromBuffer(envelope.payload);
    _gameClient.leaveRace();
  }

  movePlayer(world.MovementInput worldMI){
    MovementInput netMI = new MovementInput();
    netMI.accelerationFactor = worldMI.accelerationFactor;
    if(worldMI.newOrientation != null){
      netMI.newOrientation = worldMI.newOrientation;
    }
    netMI.rotationSpeed = worldMI.rotationSpeed;

    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.INPUT;
    envelope.payload = netMI.writeToBuffer();

    send(envelope);
  }

  requestLeaveRace(){
    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.RACE_LEAVE;
    send(envelope);
  }
}

/*

//reconnect
log('web socket closed, retrying in $_retrySeconds seconds');
if (!_encounteredError) {
  _retrySeconds *= 2;
  new Timer(new Duration(seconds:_retrySeconds),_serverConnection.connect);
}
_encounteredError = true;    
* 
*   int _retrySeconds = 2;
  bool _encounteredError = false;

* 
* ping
*     time += dt;
    if(time > 5.0){
      time = 0.0;
      log("ping $ping");
      server.send(new Envelope(MessageType.PING_PONG, ping++));
    }
*/