part of web_client;

typedef void MessageHandler(Message message);

class ServerProxy {
  ServerConnection _serverConnection;
  GameController _gameController;
  Map<String, MessageHandler> _messageHandlers;
  int _retrySeconds = 2;
  bool _encounteredError = false;
  String _desiredUsername = null;
  
  ServerProxy(this._serverConnection, this._gameController)
  {
    _serverConnection.onReceiveMessage.listen(_onReceiveMessage);
    _serverConnection.onDisconnectDelegate = _onDisconnect;
    
    _messageHandlers = 
      {
        MessageType.ENTITY: this._onEntity,
        MessageType.ENTITY_REMOVE: this._onEntityRemove,
        MessageType.PLAYER: this._onPlayer
      };
  }
  
  connect(String desiredUsername){
    _desiredUsername = desiredUsername;
    _serverConnection.connect().then((_) => _onConnect());
  }
  
  _onConnect(){
      Message message = new Message(MessageType.HANDSHAKE, _desiredUsername);
      _serverConnection.send(message);
  }
  
  // TODO: if we are going to do a handshake again, remove all objects.
  _onDisconnect(){
    //reconnect
    log('web socket closed, retrying in $_retrySeconds seconds');
    if (!_encounteredError) {
      _retrySeconds *= 2;
      new Timer(new Duration(seconds:_retrySeconds),_serverConnection.connect);
    }
    _encounteredError = true;    
  }
  
  send(Message message){
    _serverConnection.send(message);
  }
  
  _onReceiveMessage(Message message) {
    try {      
      if(message.messageType == null) {
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