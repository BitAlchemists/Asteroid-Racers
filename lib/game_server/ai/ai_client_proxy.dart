part of ai;

class AIClientProxy implements IClientProxy {

  String playerName;
  Movable movable;
  TrainingUnit trainingUnit;
  AIDirector director;

  AIClientProxy(this.director, this.trainingUnit);

  makeYourMove(){
    trainingUnit.brain.inputNetwork = [movable.position.x, movable.position.y, trainingUnit.target.position.x, trainingUnit.target.position.y];
    trainingUnit.brain.calculateOutput();
    List<double> output = trainingUnit.brain.outputNetwork;
    Vector2 acceleration = new Vector2(output[0], output[1]);
    movable.acceleration = acceleration.normalize().scale(200.0);
    movable.updateRank += 1;
  }

  void send(net.Envelope envelope){
    director.send(this, envelope);
  }
}