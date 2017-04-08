part of ai;


abstract class AIDirector implements IServerService {
  IGameServer server;
  logging.Logger _log = new logging.Logger("ai.AIDirector");

  List<IGameClient> _clients = <IGameClient>[];
  List<Script> _runningScripts = <Script>[];

  AIDirector();

  start();

  IGameClient spawnClient([String name = "Major Tom"]){

    var connection = new LocalServerConnection(gameServer: server);
    AIGameClient client = new AIGameClient(connection);
    client.username = name;
    /*
    AIClientProxy client = new AIClientProxy();
    client.server = this.server;
    client.playerName = "Major Tom";
    */
    _clients.add(client);

    client.connect();
/*
    server.connectClient(client);
    server.registerPlayer(client, client.playerName, false);
     */

    return client;
  }

  despawnClient(AIGameClient client){
    _log.fine("despawnClient()");
    client.disconnect();
    _clients.remove(client);
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
    for(AIGameClient client in _clients){
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
