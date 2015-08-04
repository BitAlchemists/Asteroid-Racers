part of ai;


class AIDirector implements IServerService {
  IGameServer server;

  Trainer trainer = new Trainer();

  AIClientProxy _demoTom;
  FlyTowardsTargetsTrainingProgram _tp;
  bool showDemo = true;
  bool trainNetworks;

  AIDirector() {
    trainNetworks = !showDemo;
  }

  start() {
    if (showDemo) {
      List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
      if (networks != null && networks.length > 0) {
        _demoTom = new AIClientProxy();
        _demoTom.server = this.server;
        server.connectClient(_demoTom);
        _demoTom.playerName = "Major Tom";
        server.registerPlayer(_demoTom, _demoTom.playerName);

        _tp = new FlyTowardsTargetsTrainingProgram();
        _tp.server = server;
        _tp.trainingCenter = new Vector2(-2300.0, 1800.0);
        //_tp.setUp();
        _tp.createTrainingUnit(new Vector2(-2000.0, 1700.0));
        _demoNetwork(networks[0]);
      }
    }

    if (trainNetworks){
      trainer.server = server;
      trainer.start();
    }
  }


  _demoNetwork(MajorTom network){
    TrainingProgramInstance tpi = new TrainingProgramInstance(_tp, network);
    tpi.client = _demoTom;

    _tp.run(tpi).then((_){
      _demoNetwork(network);
    });
  }

  void preUpdate(double dt)
  {
    if(trainNetworks) trainer.preUpdate(dt);
    if(showDemo && _demoTom != null) _demoTom.step(dt);
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    if(trainNetworks) trainer.postUpdate(dt);
  }

}
