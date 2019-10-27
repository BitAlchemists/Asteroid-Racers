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
  logging.Logger log = new logging.Logger("services.net.LocalServerConnection");

  GameServer _gameServer;
  bool _debug;
  bool _isMaster; //is this one the master or the slave?
  LocalServerConnection _inverseConnection;
  bool _disconnecting = false;
  IClientProxy _clientProxy;
  StreamController<Envelope> _receiveMessageStreamController;
  
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
    _receiveMessageStreamController = new StreamController<Envelope>.broadcast();
  }
  
  LocalServerConnection._inverse(this._inverseConnection, this._debug)
  {
    _isMaster = false;
    _receiveMessageStreamController = new StreamController<Envelope>.broadcast();
  }
  
  Future connect(){
    log.finest("connect()");
    _inverseConnection = new LocalServerConnection._inverse(this, _debug);
    _clientProxy = new ClientProxy(_inverseConnection);
    _gameServer.connectClient(_clientProxy);
    return new Future.value();
  }
  
  void disconnect(){

    assert(_disconnecting == false);
    _disconnecting = true;

    if(_isMaster){
      _inverseConnection.disconnect();
    }

    _clientProxy = null;
    _inverseConnection = null;
    _receiveMessageStreamController.close();
    _receiveMessageStreamController = null;
    this.onDisconnectDelegate();
    _gameServer = null;
  }
  
  
  void send(Envelope envelope){

    if(_disconnecting) return;

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