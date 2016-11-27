part of ai;


abstract class AIDirector implements IServerService {
  IGameServer server;

  List<IGameClient> _clients = <IGameClient>[];
  List<Script> _runningScripts = <Script>[];

  AIDirector();

  start();

  IGameClient spawnClient(){

    var connection = new LocalServerConnection(gameServer: server);
    AIGameClient client = new AIGameClient(connection);
    client.username = "Major Tom";
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
    client.disconnect();
    _clients.remove(client);
  }

  Future runScript(Script script, AIGameClient client, Network network){
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
