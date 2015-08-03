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
  Command command;

  double score;

}

abstract class Command {

  start(CommandInstance instance);
  step(CommandInstance instance, double dt);
  end(CommandInstance instance);

  void updateReward(CommandInstance instance);
}

class FlyTowardsTargetCommand implements Command {


  Vector2 target;

  FlyTowardsTargetCommand(this.target);


  start(CommandInstance instance){
    instance.state = CommandInstanceState.RUNNING;
    instance.score = _distanceToTarget(instance);
  }

  step(CommandInstance instance, double dt){
    if(instance.state == CommandInstanceState.ENDED) return;

    instance.network.inputNetwork = [instance.client.movable.position.x, instance.client.movable.position.y, target.x, target.y];
    instance.network.calculateOutput();
    List<double> output = instance.network.outputNetwork;
    Vector2 acceleration = new Vector2(output[0], output[1]);
    instance.client.movable.acceleration = acceleration.normalize().scale(200.0);
  }

  end(CommandInstance instance){
    if(instance.state == CommandInstanceState.ENDED) return;

    print("${instance.network.name} died. Reward: ${instance.score}");

    instance.state = CommandInstanceState.ENDED;

  }

  void updateReward(CommandInstance instance){
    double distance = _distanceToTarget(instance);
    if(distance < instance.score) {
      instance.score = distance;
    }
  }

  double _distanceToTarget(CommandInstance instance){
    return instance.client.movable.position.distanceTo(this.target);
  }
}