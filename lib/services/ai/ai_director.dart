part of ai;


class AIDirector implements IServerService {
  IGameServer server;

  Trainer trainer = new Trainer();

  AIClientProxy _demoTom;
  FlyTowardsTargetsTrainingProgram _tp;

  AIDirector();

  start(){
    trainer.server = server;
    trainer.start();

    List<MajorTom> networks = LukeSerializer.readNetworksFromFile();
    if(networks != null && networks.length > 0){
      _demoTom = new AIClientProxy();
      _demoTom.server = this.server;
      server.connectClient(_demoTom);
      _demoTom.playerName = "Major Tom";
      server.registerPlayer(_demoTom, _demoTom.playerName);

      _tp = new FlyTowardsTargetsTrainingProgram();
      _tp.server = server;
      _tp.trainingCenter = new Vector2.zero();
      _tp.setUp();
      _demoNetwork(networks[0]);
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
    trainer.preUpdate(dt);
    if(_demoTom != null) _demoTom.step(dt);
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    trainer.postUpdate(dt);
  }

}
