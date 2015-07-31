library game_client_net;

import "dart:async";
import 'dart:html' as html;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/world.dart" as world;
import "package:asteroidracers/game_client/utils/client_logger.dart";
import "package:asteroidracers/game_server/game_server.dart"; //this is used for the simulated local server
import "package:asteroidracers/game_server/client_proxy.dart"; //this is used for the simulated local server
import 'package:asteroidracers/shared/shared_server.dart';
import 'package:asteroidracers/shared/shared_client.dart';

part "net/local_server_connection.dart";
part "net/server_connection.dart";
part "net/web_socket_server_connection.dart";

typedef void MessageHandler(Envelope envelope);

class ServerConnectionState {
  static const int DISCONNECTED = 0;
  static const int IS_CONNECTING = 1;
  static const int CONNECTED = 2; 
}

class ServerProxy {
  ServerConnection _serverConnection;
  IGameClient _gameController;
  Map<String, MessageHandler> _messageHandlers;
  Function onDisconnectDelegate;
  int _state = ServerConnectionState.DISCONNECTED;
  
  int get state => _state;
  ServerConnection get connection => _serverConnection;
  
  ServerProxy(this._gameController)
  {    
    _messageHandlers = 
      {
        MessageType.ENTITY: this._onEntityUpdate,
        MessageType.ENTITY_REMOVE: this._onEntityRemove,
        MessageType.PLAYER: this._onPlayer,
        MessageType.PING_PONG: this._onPingPong,
        MessageType.COLLISION: this._onCollision
      };
  }
  
  registerMessageHandler(MessageType messageType, MessageHandler messageHandler)
  {
    _messageHandlers[messageType.name] = messageHandler;
  }
  
  Future connect(bool local, bool debugJson, String desiredUsername)
  {
    if(local) {
      _serverConnection = localConnection(debugJson);    
    }
    else
    {
      _serverConnection = webConnection();  
    }
    
    _serverConnection.onReceiveMessage.listen(_onReceiveMessage);
    _serverConnection.onDisconnectDelegate = _onDisconnect;
    
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
  
  Connection webConnection()
  {
    //ServerConnection server;
    //var domain = html.document.domain;
    html.Location location = html.window.location;
    var port = 1337;
    var wsPath = "ws://" + location.hostname + ":" + port.toString() + "/ws";
    return new WebSocketServerConnection(wsPath);
  }

  Connection localConnection(bool debug)
  {
    return new LocalServerConnection(debug);
  }
  
  disconnect()
  {
    _serverConnection.disconnect();
  }
  
  _onDisconnect()
  {
    _state = ServerConnectionState.DISCONNECTED;
    _serverConnection = null;
    this.onDisconnectDelegate();
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
        print("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[envelope.messageType];
      
      if(messageHandler != null){
        messageHandler(envelope);
      }
      else {
        print("no appropriate message handler for messageType ${envelope.messageType} found.");
      }            
    }
    catch (e, stack)
    {
      print("exception during ServerProxy.onMessage: ${e.toString()}\nStack:\n$stack");
    }
  }
  
  _onEntityRemove(Envelope envelope)
  {
    _gameController.removeEntity(envelope.payload[0]);
  }

  _onEntityUpdate(Envelope envelope)
  {
    Entity netEntity = new Entity.fromBuffer(envelope.payload);
    world.Entity worldEntity = EntityMarshal.netEntityToWorldEntity(netEntity);
    _gameController.updateEntity(worldEntity);
  }
  
  _onPlayer(Envelope envelope)
  {
    Entity entity = new Entity.fromBuffer(envelope.payload);
    world.Movable movable = EntityMarshal.netEntityToWorldEntity(entity);
    _gameController.createPlayer(movable);
  }
  
  ping(){
    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.PING_PONG;
    envelope.payload = <int>[new DateTime.now().millisecondsSinceEpoch];
    send(envelope);
  }
  
  double pingAverage = 0.0;
  
  _onPingPong(Envelope envelope){
    int ms = envelope.payload[0];
    int now = new DateTime.now().millisecondsSinceEpoch;
    int ping = now - ms;
    
    if (pingAverage == null) {
      pingAverage = ping.toDouble();
    }

    pingAverage = ping * 0.05 + pingAverage * 0.95;
  }
  
  _onCollision(Envelope envelope){
    _gameController.handleCollision(envelope.payload[0]);
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