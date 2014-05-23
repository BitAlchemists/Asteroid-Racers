part of web_client;

typedef void OnReceiveMessageFunction(Message message);

class LocalServerConnection implements ServerConnection {
  
  final bool _debug;
  bool _isMaster; //is this one the master or the slave?
  LocalServerConnection _inverseConnection;
  ClientProxy _clientProxy; 
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();
  
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  LocalServerConnection([bool this._debug = false])
  {
    _isMaster = true;
  }
  
  LocalServerConnection._inverse(this._inverseConnection, this._debug)
  {
    _isMaster = false;
  }
  
  Future connect(){
    ClientProxy.worldServer = new WorldServer();
    _inverseConnection = new LocalServerConnection._inverse(this, _debug);
    _clientProxy = new ClientProxy(_inverseConnection);
    ClientProxy.worldServer.connectClient(_clientProxy);
    return new Future.value();
  }
  
  void disconnect(){
    if(_isMaster){
      _inverseConnection.disconnect();
      _clientProxy = null;
      ClientProxy.worldServer = null;
    }
    
    
    _inverseConnection = null;
    this.onDisconnectDelegate();
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