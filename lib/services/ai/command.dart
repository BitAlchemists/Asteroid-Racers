part of ai;


enum CommandInstanceState
{
  READY,
  RUNNING,
  ENDED
}

class CommandInstance {

  CommandInstanceState state = CommandInstanceState.READY;
  MajorTom network;
  AIClientProxy client;
  //Completer completer;
  Command command;

  double reward;

}

abstract class Command {

  start(CommandInstance instance);
  step(CommandInstance instance, double dt);
  end(CommandInstance instance);

  void updateReward(CommandInstance instance);
}

class FlyTowardsTargetCommand implements Command {


  Checkpoint target;

  FlyTowardsTargetCommand(this.target);


  start(CommandInstance instance){
    target.state = CheckpointState.CURRENT;
    target.updateRank += 1;
    instance.state = CommandInstanceState.RUNNING;
    //instance.completer = new Completer();
  }

  step(CommandInstance instance, double dt){
    if(instance.state == CommandInstanceState.ENDED) return;

    instance.network.inputNetwork = [instance.client.movable.position.x, instance.client.movable.position.y, target.position.x, target.position.y];
    instance.network.calculateOutput();
    List<double> output = instance.network.outputNetwork;
    Vector2 acceleration = new Vector2(output[0], output[1]);
    instance.client.movable.acceleration = acceleration.normalize().scale(200.0);
  }

  end(CommandInstance instance){
    if(instance.state == CommandInstanceState.ENDED) return;

    print("${instance.network.name} died. Reward: ${instance.reward}");

    instance.state = CommandInstanceState.ENDED;
    target.state = CheckpointState.CLEARED;
    target.updateRank += 1;
    instance.client.server.disconnectClient(instance.client);
    instance.client.currentCommandInstance = null;
    instance.client.server = null;
    instance.client = null;
    //instance.completer.complete();

  }

  void updateReward(CommandInstance instance){
    double distance = _distanceToTarget(instance);
    if(distance < instance.reward) {
      instance.reward = distance;
    }
  }

  double _distanceToTarget(CommandInstance instance){
    return instance.client.movable.position.distanceTo(this.target.position);
  }
}