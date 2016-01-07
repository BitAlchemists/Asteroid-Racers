library net_local_server_connection;

import "dart:async";

import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/shared_server.dart";
import "package:asteroidracers/services/net/server_connection.dart";
import "package:asteroidracers/game_server/game_server.dart";
import "package:asteroidracers/game_server/client_proxy.dart";


typedef void OnReceiveMessageFunction(Envelope envelope);

class LocalServerConnection implements ServerConnection {
  logging.Logger log = new logging.Logger("LocalServerConnection");
  
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