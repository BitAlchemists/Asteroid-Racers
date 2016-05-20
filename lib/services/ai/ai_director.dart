part of ai;


abstract class AIDirector implements IServerService {
  IGameServer server;

  List<AIClientProxy> _clients = <AIClientProxy>[];
  List<Script> _scripts = <Script>[];

  AIDirector();

  start();

  AIClientProxy spawnClient(){
    AIClientProxy client = new AIClientProxy();
    client.server = this.server;
    client.playerName = "Major Tom";
    _clients.add(client);

    server.connectClient(client);
    server.registerPlayer(client, client.playerName, false);

    return client;
  }

  despawnClient(AIClientProxy client){
    server.disconnectClient(client);
    _clients.remove(client);
  }

  Future runScript(Script script, AIClientProxy client, Network network){
    script.director = this;
    script.client = client;
    script.network = network;
    _scripts.add(script);
    return script.run().then((_){
      _scripts.remove(script);
    });
  }

  void preUpdate(double dt)
  {
    for(AIClientProxy client in _clients){
      client.step(dt);
    }
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    for(Script script in _scripts){
      script.step(dt);
    }
  }

}
