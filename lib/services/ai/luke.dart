part of ai;

class Luke extends Network {

  String name;
  Neuron umbral;
  int generation = 0;
  double best_reward = double.MAX_FINITE;

  Luke(int numInputNeurons, int numOutputNeurons, [this.name]):super() {
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
    umbral = new Neuron("Umbral");
    umbral.input = 1.0;
    umbral.output = 1.0;
    for(Neuron outputNeuron in outputLayer.neurons)
    {
      outputNeuron.addInputConnectionFromNeuron(umbral);
    }

    //Connect everything
    this.addLayer(inputLayer);
    this.addLayer(outputLayer);

    //connect layers
    this.connectLayers();
  }

  //similar to base classes connectLayers, but with weights ranging [-1,+1]
  void connectLayers() {

    for (int k = this.layers.length - 1; k > 0; k--) {
      for (int i = 0; i < this.layers[k].neurons.length; i++) {
        for (int j = 0; j < this.layers[k - 1].neurons.length; j++) {
          Neuron neuron = this.layers[k].neurons[i];
          neuron.addInputConnection(new Connection(this.layers[k - 1].neurons[j], neuron, 2*random.nextDouble()-1));
        }
      }
    }
  }

  void mutate(double mutationRate)
  {
    for(Neuron neuron in this.outputNeurons)
    {
      for(Connection connection in neuron.inputConnections){
        connection.weight.value += mutationRate * (random.nextDouble() * 2 - 1);
      }
    }
  }

/*
  BasicLearningRule adalineLearning = new BasicLearningRule(maxIterations);
    adalineLearning.network = this;
    adalineLearning.errorFunction = new MeanSquareError();
    adalineLearning.learningRate = 0.01;
    this.learningRule = adalineLearning;
   */

}