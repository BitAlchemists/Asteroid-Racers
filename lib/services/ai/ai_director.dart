part of ai;

class AIClientIsolateManager {
  SendPort _sendPort;
  ReceivePort _receivePort = new ReceivePort();

  AIClientIsolateManager(this._sendPort){
    _receivePort.listen(_didReceiveMessage);
    _sendPort.send(_receivePort.sendPort);

    /*
    AIGameClient client = new AIGameClient(connection);
    client.username = name;
    client.connect();
    */
  }

  _didReceiveMessage(var message){

  }

}

class AIClientIsolateProxy {
  ReceivePort _receivePort = new ReceivePort();
  ReceivePort get receivePort => _receivePort;
  SendPort _sendPort;

  AIClientIsolateProxy(){
    _receivePort.listen(_didReceiveMessage);
  }

  destructor(){
    _receivePort.close();
    _receivePort = null;
    _sendPort = null;
  }

  _didReceiveMessage(var message){
    if(message is SendPort){
      _sendPort = message;
    }
  }
}

abstract class AIDirector implements IServerService {
  IGameServer server;
  logging.Logger _log = new logging.Logger("ai.AIDirector");

  List<AIClientIsolateProxy> _clientIsolateProxies = <AIClientIsolateProxy>[];

  AIDirector();

  destructor(){

  }

  start();

  /// this method bootstraps the client isolate
  _clientIsolateEntrypoint(SendPort sendPort){
    AIClientIsolateManager manager = new AIClientIsolateManager(sendPort);
  }

  Future<AIClientIsolateProxy> _runClientInIsolate([String name = "Major Tom"]) async {

    AIClientIsolateProxy proxy = new AIClientIsolateProxy();
    Isolate clientIsolate = await Isolate.spawn(_clientIsolateEntrypoint, proxy.receivePort.sendPort);
    //TE 2017-04-15: we don't keep the isolate here. maybe we should retain it?

    /*
    AIClientProxy client = new AIClientProxy();
    client.server = this.server;
    client.playerName = "Major Tom";
    */
    _clientIsolateProxies.add(proxy);

/*
    server.connectClient(client);
    server.registerPlayer(client, client.playerName, false);
     */

    return proxy;
  }

  despawnClient(AIGameClient client){
    _log.fine("despawnClient()");
    client.disconnect();
    _clientIsolates.remove(client);
    client.destructor();
  }

  Future runScript(Script script, AIGameClient client, Network network){
    _log.fine("runScript()");
    script.director = this;
    script.client = client;
    script.network = network;
    _runningScripts.add(script);
    return script.run().then((_){
      _runningScripts.remove(script);
    });
  }

  void preUpdate(double dt)
  {
    for(AIGameClient client in _clientIsolates){
      client.step(dt);
    }
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    for(Script script in _runningScripts){
      script.step(dt);
    }
  }

}
