part of ai;

class AIController implements IClientProxy {

  String playerName;
  Movable movable;
  T1Brain _brain;

  AIController(){
    _brain = new T1Brain(4,2);
  }

  makeYourMove(Entity target){
    _brain.inputNetwork = [movable.position.x, movable.position.y, target.position.x, target.position.y];
    _brain.calculateOutput();
    List<double> output = _brain.outputNetwork;
    Vector2 acceleration = new Vector2(output[0], output[1]);
    movable.acceleration = acceleration.normalize().scale(200.0);
    movable.updateRank += 1;
  }

  void send(net.Envelope envelope){

  }
}

class T1Brain extends Network {

  T1Brain(int numInputNeurons, int numOutputNeurons):super() {
    this.createNetwork(numInputNeurons, numOutputNeurons);
  }

  void createNetwork(int numInputNeurons, int numOutputNeurons) {

    //Input Layer
    Layer inputLayer = new Layer("InputLayer");
    inputLayer.createNeurons(numInputNeurons);

    //OutPut Layer
    Layer outputLayer = new Layer("OutputLayer");

    outputLayer.createNeurons(numOutputNeurons, inputFunction: new WeightCombination(), activationFunction: new Lineal());

    //Bias
    Neuron umbral = new Neuron("Umbral");
    umbral.input = 1.0;
    umbral.output = 1.0;
    for(Neuron outputNeuron in outputLayer.neurons)
    {
      outputNeuron.addInputConnectionFromNeuron(umbral);
    }

    //Connect everything
    this.addLayer(inputLayer);
    this.addLayer(outputLayer);
    this.connectLayers();
  }

/*
  BasicLearningRule adalineLearning = new BasicLearningRule(maxIterations);
    adalineLearning.network = this;
    adalineLearning.errorFunction = new MeanSquareError();
    adalineLearning.learningRate = 0.01;
    this.learningRule = adalineLearning;
   */

}