part of ai;

/**
 * For use in a demo context to race towards a series of targets
 */
class RaceTargetScript extends Script {

  AIGameClient client;
  NeuralNetwork network;
  Completer _completer;
  TargetVehicleController _vehicleController;
  logging.Logger log = new logging.Logger("services.ai.RaceTargetScript");

  RaceTargetScript(this.network);

  static const int DELAY = 5;

  Future run() async{
    log.info("run()");
    assert(network != null);
    if (state == ScriptState.READY) {
      client = await director.createClient();
      _vehicleController = new TargetVehicleController();
      _vehicleController.network = network;
      _vehicleController.client = client;
      client.vehicleController = _vehicleController;
      client.updateEntityDelegate = updateEntity;
      client.activateCheckpointDelegate = activateNextCheckpoint;

      await client.connect();

      state = ScriptState.RUNNING;

      _completer = new Completer();
      return _completer.future;
    }
    else {
      log.warning(
          "Trying to run() script, but script state is ${state.toString()}");
      return new Future.value(null);
    }
  }

  void step(double dt){
    log.fine("step()");

  }

  updateEntity(Entity entity) {
    log.fine("updateEntity()");

    if (entity.type == EntityType.LAUNCH_PLATFORM &&
        _vehicleController.target == null) {
      new Timer(new Duration(seconds: DELAY), (){
        _vehicleController.target = entity;
      });
    }
  }

  activateNextCheckpoint(Entity entity){
    log.info("activateNextCheckpoint()");

    new Timer(new Duration(seconds: DELAY), () {
      _vehicleController.target = entity;
    });
  }

  _finish(){
    log.info("_finish()");
    client.disconnect();
    client.activateCheckpointDelegate = null;
    client.updateEntityDelegate = null;
    client.vehicleController = null;

    _vehicleController.network = null;
    _vehicleController.client = null;
    _vehicleController = null;

    director.destroyClient(client);
    client = null;

    state = ScriptState.ENDED;
    _completer.complete();
  }
}

