part of ai;


abstract class AIDirector implements IServerService {
  IGameServer server;

  List<Script> _runningScripts = <Script>[];
  List<IGameClient> _clients = <IGameClient>[];

  AIDirector();

  start();

  Future runScript(Script script){
    script.director = this;
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

  IGameClient createClient(){

    var connection = new LocalServerConnection(gameServer: server);
    AIGameClient client = new AIGameClient(connection);
    client.username = "Major Tom";
    /*
    AIClientProxy client = new AIClientProxy();
    client.server = this.server;
    client.playerName = "Major Tom";
    */
    _clients.add(client);
/*
    server.connectClient(client);
    server.registerPlayer(client, client.playerName, false);
     */

    return client;
  }

  destroyClient(AIGameClient client){
    _clients.remove(client);
  }
}
