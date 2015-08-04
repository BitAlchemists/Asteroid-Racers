part of ai;

class MajorTom extends Network {

  String name;
  Neuron umbral;
  int generation = 0;
  Network network;
  final double INITIAL_WEIGHT_RANGE = 1.0;

  MajorTom(List<int> neuronsInLayers, [this.name]):super() {
    this.createNetwork(neuronsInLayers);
  }

  void createNetwork(List<int> neuronsInLayers) {

    //Input Layer
    Layer inputLayer = new Layer("InputLayer");
    inputLayer.createNeurons(neuronsInLayers[0]);

    //Bias
    umbral = new Neuron("Umbral");
    umbral.input = 1.0;
    umbral.output = 0.0;

    //Connect everything
    this.addLayer(inputLayer);

    for (int i = 1; i < neuronsInLayers.length; i++) {
      Layer layer = new Layer("HiddenLayer" + i.toString());
      layer.createNeurons(neuronsInLayers[i], inputFunction: new WeightCombination(), activationFunction: new Tanh());
      this.addLayer(layer);
      for (Neuron neuron in this.layers[i].neurons) {
        neuron.addInputConnection(new Connection(umbral, neuron, INITIAL_WEIGHT_RANGE*2*random.nextDouble()-INITIAL_WEIGHT_RANGE));
      }
    }

    //connect layers
    this.connectLayers();
  }

  //similar to base classes connectLayers, but with weights ranging [-1,+1]
  void connectLayers() {

    for (int k = this.layers.length - 1; k > 0; k--) {
      for (int i = 0; i < this.layers[k].neurons.length; i++) {
        for (int j = 0; j < this.layers[k - 1].neurons.length; j++) {
          Neuron neuron = this.layers[k].neurons[i];
          neuron.addInputConnection(new Connection(this.layers[k - 1].neurons[j], neuron, INITIAL_WEIGHT_RANGE*2*random.nextDouble()-INITIAL_WEIGHT_RANGE));
        }
      }
    }
  }

  void mutate(double mutationRate)
  {
    for(Layer layer in this.layers)
    {
      for(Neuron neuron in layer.neurons)
      {
        for(Connection connection in neuron.inputConnections){
          connection.weight.value *= 1 + mutationRate * (random.nextDouble() * 2 - 1);
          //if a connection weight is smaller than 0.001, it may change sign
          if(connection.weight.value.abs() < 0.001) {
            if(random.nextDouble() > 0.5) connection.weight.value *= -1;
          }
        }
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