part of game_client;

typedef void MessageHandler(Envelope envelope);

class ServerConnectionState {
  static const int DISCONNECTED = 0;
  static const int IS_CONNECTING = 1;
  static const int CONNECTED = 2; 
}

class ServerProxy {
  ServerConnection _serverConnection;
  GameClient _gameController;
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
    _messageHandlers[messageType] = messageHandler;
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
      Envelope envelope = new Envelope();
      envelope.messageType = MessageType.HANDSHAKE;
      envelope.payload = desiredUsername;
      _serverConnection.send(envelope);
    });
  }
  
  Connection webConnection()
  {
    ServerConnection server;
    var domain = html.document.domain;
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
    _gameController.removeEntity(envelope.payload);
  }

  _onEntityUpdate(Envelope envelope)
  {
    Entity entity = new Entity.deserialize(envelope.payload);
    _gameController.updateEntity(entity);
  }
  
  _onPlayer(Envelope envelope)
  {
    Entity entity = new Movable.fromJson(envelope.payload);
    _gameController.createPlayer(entity);
  }
  
  ping(){
    send(new Envelope(MessageType.PING_PONG, new DateTime.now().millisecondsSinceEpoch));
  }
  
  double pingAverage = 0.0;
  
  _onPingPong(Envelope envelope){
    int ms = envelope.payload;
    int now = new DateTime.now().millisecondsSinceEpoch;
    int ping = now - ms;
    
    if (pingAverage == null) {
      pingAverage = ping.toDouble();
    }

    pingAverage = ping * 0.05 + pingAverage * 0.95;
  }
  
  _onCollision(Envelope envelope){
    _gameController.handleCollision(envelope.payload);
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