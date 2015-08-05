part of ai;


class AIDirector implements IServerService {
  IGameServer server;

  Trainer trainer = new Trainer();

  List<AIClientProxy> _clients = <AIClientProxy>[];
  List<Script> _scripts = <Script>[];

  TrainingProgramInstance _tpi;
  bool showDemo = true;
  bool trainNetworks;

  AIDirector() {
    trainNetworks = !showDemo;
  }

  start() {
    if (showDemo) {
      List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
      if (networks != null && networks.length > 0) {
        var client = spawnClient();
        runScript(new CircleTargetScript(), client, networks[0]);
      }
    }

    if (trainNetworks){
      trainer.server = server;
      trainer.start();
    }
  }

  AIClientProxy spawnClient(){
    AIClientProxy client = new AIClientProxy();
    client.server = this.server;
    client.playerName = "Major Tom";
    _clients.add(client);

    server.connectClient(client);
    server.registerPlayer(client, client.playerName);

    return client;
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
    if(trainNetworks) trainer.preUpdate(dt);

    for(AIClientProxy client in _clients){
      client.step(dt);
    }
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    if(trainNetworks) trainer.postUpdate(dt);

    for(Script script in _scripts){
      script.step(dt);
    }
  }

}
