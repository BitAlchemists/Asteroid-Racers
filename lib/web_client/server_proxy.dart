part of web_client;

typedef void MessageHandler(Message message);

class ServerProxy {
  ServerConnection _serverConnection;
  GameController _gameController;
  Map<String, MessageHandler> _messageHandlers;
  
  ServerProxy(this._serverConnection, this._gameController)
  {
    _serverConnection.onReceiveMessage.listen(_onReceiveMessage);
    
    _messageHandlers = 
      {
        MessageType.ENTITY: this._onEntity,
        MessageType.PLAYER: this._onPlayer
      };
  }
  
  connect(){
    _serverConnection.connect().then((_) => _onConnect());
  }
  
  _onConnect(){
      Message message = new Message();
      message.messageType = MessageType.HANDSHAKE;
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
  
  _onPlayer(Message message)
  {
    Entity entity = new Entity.fromJson(message.payload);
    _gameController.createPlayer(entity);
  }

  
  _onEntity(Message message)
  {
    Entity entity = new Entity.fromJson(message.payload);
    _gameController.updateEntity(entity);
  }
}