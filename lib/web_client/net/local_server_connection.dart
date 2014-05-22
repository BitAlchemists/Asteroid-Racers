part of web_client;

typedef void OnReceiveMessageFunction(Message message);

class LocalServerConnection implements ServerConnection {
  
  final bool _debug;
  LocalServerConnection _inverseConnection;
  ClientProxy _clientProxy; 
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();
  
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  LocalServerConnection([bool this._debug = false]);
  LocalServerConnection._inverse(this._inverseConnection, this._debug);
  
  Future connect(){
    WorldServer worldServer = new WorldServer();
    _inverseConnection = new LocalServerConnection._inverse(this, _debug);
    _clientProxy = new ClientProxy(_inverseConnection);
    return new Future.value();
  }
  
  
  void send(var message){
    if(_debug) {
      message = message.toJson();      
    }
    _inverseConnection._receiveMessage(message);
  }
  
  void _receiveMessage(var message)
  {
    if(_debug) {
      message = new Message.fromJson(message);      
    }
    _receiveMessageStreamController.add(message);
  }
}