part of ai;

class FlyTowardsTargetsTrainingProgram extends TrainingProgram {
  final int NUM_TARGETS = 24;
  final double TARGET_DISTANCE = 200.0;
  Vector2 trainingCenter = new Vector2(-2700.0,1800.0);
  int LIFETIME_MILLISECONDS = 1000;



  FlyTowardsTargetsTrainingProgram();

  setUp(){

    trainingUnits = new List<TrainingUnit>.generate(NUM_TARGETS, (int i){
      num angle = (i.toDouble() / NUM_TARGETS.toDouble());
      Vector2 position = new Vector2(Math.cos(angle * Math.PI * 2) * TARGET_DISTANCE, Math.sin(angle * Math.PI * 2) * TARGET_DISTANCE);

      Checkpoint checkpoint = new Checkpoint();
      checkpoint.position = position + trainingCenter;
      checkpoint.radius = 30.0;
      checkpoint.orientation = 0.0;
      checkpoint.state = CheckpointState.CLEARED;

      server.world.addEntity(checkpoint);

      return new FlyTowardsTargetTrainingUnit(trainingCenter,checkpoint, LIFETIME_MILLISECONDS);
    });

  }

  tearDown(){
    for(FlyTowardsTargetTrainingUnit tu in trainingUnits){
      server.world.removeEntity(tu.target);
    }

    trainingUnits.clear();
  }
}

class FlyTowardsTargetTrainingUnit extends TrainingUnit {
  Vector2 spawn;
  Checkpoint target;
  int lifetimeMilliseconds;
  Command _command;

  FlyTowardsTargetTrainingUnit(this.spawn, this.target, this.lifetimeMilliseconds) {
    _command = new FlyTowardsTargetCommand(target.position);
  }

  Future<double> run(TrainingProgramInstance tpi){

    tpi.client.server.teleportPlayerTo(tpi.client,spawn,0.0,false);

    CommandInstance ci = new CommandInstance();
    ci.client = tpi.client;
    ci.network = tpi.network;
    ci.command = _command;
    tpi.client.currentCommandInstance = ci;
    tpi.client.currentCommandInstance.command.start(tpi.client.currentCommandInstance);
    target.state = CheckpointState.CURRENT;
    target.updateRank += 1;

    return new Future.delayed(new Duration(milliseconds: lifetimeMilliseconds)).then((_){

      ci.command.end(ci);
      target.state = CheckpointState.CLEARED;
      target.updateRank += 1;

      tpi.client.currentCommandInstance = null;

      return ci.score;
    });
  }

}