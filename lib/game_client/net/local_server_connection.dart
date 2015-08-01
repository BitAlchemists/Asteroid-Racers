part of game_client_net;

typedef void OnReceiveMessageFunction(Envelope envelope);

class LocalServerConnection implements ServerConnection {
  
  final bool _debug;
  bool _isMaster; //is this one the master or the slave?
  LocalServerConnection _inverseConnection;
  IClientProxy _clientProxy;
  final StreamController<Envelope> _receiveMessageStreamController = new StreamController<Envelope>.broadcast();
  
  Stream<Envelope> get onReceiveMessage => _receiveMessageStreamController.stream;
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
    GameServer gameServer = new GameServer();
    ClientProxy.gameServer = gameServer;
    gameServer.start();
    _inverseConnection = new LocalServerConnection._inverse(this, _debug);
    _clientProxy = new ClientProxy(_inverseConnection);
    ClientProxy.gameServer.connectClient(_clientProxy);
    return new Future.value();
  }
  
  void disconnect(){
    if(_isMaster){
      _inverseConnection.disconnect();
      _clientProxy = null;
      ClientProxy.gameServer = null;
    }
    
    
    _inverseConnection = null;
    this.onDisconnectDelegate();
  }
  
  
  void send(Envelope envelope){

    var object = envelope;

    if(_debug) {
      object = envelope.writeToBuffer();
    }

    _inverseConnection._receiveMessage(object);
  }
  
  void _receiveMessage(var object)
  {
    assert(object != null);
    
    if(_debug) {
      object = new Envelope.fromBuffer(object);
    }
    _receiveMessageStreamController.add(object);
  }
}