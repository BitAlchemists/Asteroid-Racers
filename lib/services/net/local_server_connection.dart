library net_local_server_connection;

import "dart:async";

import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/net/server_connection.dart";
export "package:asteroidracers/services/net/server_connection.dart";
import "package:asteroidracers/game_server/game_server.dart";
import "package:asteroidracers/game_server/client_proxy.dart";


typedef void OnReceiveMessageFunction(Envelope envelope);

class LocalServerConnection implements ServerConnection {
  logging.Logger log = new logging.Logger("LocalServerConnection");

  GameServer _gameServer;
  bool _debug;
  bool _isMaster; //is this one the master or the slave?
  LocalServerConnection _inverseConnection;
  IClientProxy _clientProxy;
  final StreamController<Envelope> _receiveMessageStreamController = new StreamController<Envelope>.broadcast();
  
  Stream<Envelope> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  LocalServerConnection({bool debug:false, IGameServer gameServer})
  {
    _debug = debug;
    if(gameServer != null) {
      _gameServer = gameServer;
    }
    else {
      log.info("Starting dedicated GameServer");
      _gameServer = new GameServer();
      ClientProxy.gameServer = _gameServer;
      _gameServer.start();
    }
    _isMaster = true;
  }
  
  LocalServerConnection._inverse(this._inverseConnection, this._debug)
  {
    _isMaster = false;
  }
  
  Future connect(){
    _inverseConnection = new LocalServerConnection._inverse(this, _debug);
    _clientProxy = new ClientProxy(_inverseConnection);
    _gameServer.connectClient(_clientProxy);
    return new Future.value();
  }
  
  void disconnect(){
    if(_isMaster){
      _inverseConnection.disconnect();
      _clientProxy = null;
    }
    
    
    _inverseConnection = null;
    this.onDisconnectDelegate();
  }
  
  
  void send(Envelope envelope){

    var object = envelope;

    if(_debug) {
      object = envelope.writeToBuffer();
    }

    if(_inverseConnection != null){
      _inverseConnection._receiveMessage(object);
    }
    else
    {
      log.info("_inverseConnection is null");
    }

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