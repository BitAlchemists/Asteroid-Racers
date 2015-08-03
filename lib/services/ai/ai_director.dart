part of ai;


class AIDirector implements IServerService {
  IGameServer server;

  Trainer trainer = new Trainer();

  AIDirector();

  start(){
    trainer.server = server;
    trainer.start();
  }

  void preUpdate(double dt)
  {
    trainer.preUpdate(dt);
  }

  void update(double dt)
  {
  }

  void postUpdate(double dt)
  {
    trainer.postUpdate(dt);
  }

}
