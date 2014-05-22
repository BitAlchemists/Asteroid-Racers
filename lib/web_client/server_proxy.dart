part of web_client;

typedef void MessageHandler(Message message);

class ServerConnectionState {
  static const int DISCONNECTED = 0;
  static const int IS_CONNECTING = 1;
  static const int CONNECTED = 2; 
}

class ServerProxy {
  ServerConnection _serverConnection;
  GameController _gameController;
  Map<String, MessageHandler> _messageHandlers;
  Function onDisconnectDelegate;
  int _state = ServerConnectionState.DISCONNECTED;
  
  int get state => _state;
  ServerConnection get connection => _serverConnection;
  
  ServerProxy(this._gameController)
  {    
    _messageHandlers = 
      {
        MessageType.ENTITY: this._onEntity,
        MessageType.ENTITY_REMOVE: this._onEntityRemove,
        MessageType.PLAYER: this._onPlayer
      };
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
      Message message = new Message(MessageType.HANDSHAKE, desiredUsername);
      _serverConnection.send(message);        
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
  
  send(Message message)
  {
    _serverConnection.send(message);
  }
  
  _onReceiveMessage(Message message) 
  {
    try {      
      if(message.messageType == null) 
      {
        print("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[message.messageType];
      
      if(messageHandler != null){
        messageHandler(message);
      }
      else {
        print("no appropriate message handler for messageType ${message.messageType} found.");
      }            
    }
    catch (e)
    {
      print("exception during ServerProxy.onMessage: ${e.toString()}");
    }
  }
  
  _onEntityRemove(Message message)
  {
    _gameController.removeEntity(message.payload);
  }

  _onEntity(Message message)
  {
    Entity entity = new Entity.fromJson(message.payload);
    _gameController.updateEntity(entity);
  }
  
  _onPlayer(Message message)
  {
    Entity entity = new Entity.fromJson(message.payload);
    _gameController.createPlayer(entity);
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

*/