part of ai;

abstract class FeedForwardNeuralNetwork extends NeuralNetwork {
  List<Layer> layers;

  FeedForwardNeuralNetwork.generate(Object configuration, String name) : super.generate(configuration, name);

  void addLayer(Layer layer) {
    this.layers.add(layer);
  }

  void addLayerAt(int index, Layer layer) {
    this.layers.insert(index, layer);
  }

  void removeLayer(Layer layer) {
    this.layers.remove(layer);
  }

  void removeLayerAt(int index) {
    this.layers.removeAt(index);
  }

  void removeAllLayers() {
    this.layers = [];
  }
}

class MajorTom extends FeedForwardNeuralNetwork {

  final List<Neuron> _inputs = new List<Neuron>();
  List<Neuron> get inputNeurons => _inputs;
  final List<Neuron> _outputs = new List<Neuron>();
  List<Neuron> get outputNeurons => _outputs;

  String name;
  Neuron umbral;
  int generation = 0;
  NeuralNetwork network;
  final double INITIAL_WEIGHT_RANGE = 1.0;

  MajorTom(List<int> configuration, name) : super.generate(configuration, name)
   {
    this.createNetwork(configuration);
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

  void mutate(double mutationRate, double mutationStrength, Function connectionMutator){
    for(Layer layer in this.layers)
    {
      for(Neuron neuron in layer.neurons)
      {
        for(Connection connection in neuron.inputConnections){
          connectionMutator(mutationRate, mutationStrength, connection);
        }
      }
    }
  }

  // mutationRate is the chance that a given neuron might mutate. 0.1 would be a 10% chance that the neuron will change
  // mutationStrength tells how many % a value might change. 1.0 would change it by 100%
  static void mutateConnectionRelative(double mutationRate, double mutationStrength, Connection connection)
  {
    if (random.nextDouble() < mutationRate) {
      connection.weight *= 1 + mutationStrength * (random.nextDouble() * 2 - 1);
      //if a connection weight is smaller than 0.001, it may change sign
      if(connection.weight.abs() < 0.001) {
        if(random.nextDouble() > 0.5) connection.weight *= -1;
      }
    }
  }

  static void mutateConnectionAbsolute(double mutationRate, double mutationStrength, Connection connection)
  {
    if (random.nextDouble() < mutationRate) {
      double delta = (random.nextDouble() * 2 - 1) * mutationStrength;
      connection.weight = (connection.weight + delta).clamp(-1.0, 1.0);
    }
  }

}


class Layer {

  String id;
  List<Neuron> neurons;

  ///
  /// [new Layer] use to create a layer.
  /// You can create a layer starting from a list of neurons.
  /// By default an empty layer neurons are created.
  ///

  Layer(this.id, {List<Neuron>neurons}) {
    if (neurons != null) {
      this.neurons = neurons;
    } else {
      this.neurons = [];
    }
  }

  ///
  /// Creates equal neurons forming the layer. Just provide the number of neurons of the layer.
  ///
  /// Example:
  ///   layer.createNeurons(5,InputFunction: some_input_function, ActivationFunction: some_activation_function);
  ///   Add 5 new neurons with some_input_function and some_activation_function.

  void createNeurons(int count, {InputFunction inputFunction, ActivationFunction activationFunction}) {
    this.neurons = [];
    for (int i = 0; i < count; i++) {
      Neuron temp = new Neuron("Neuron_" + i.toString(), inputFunction: inputFunction, activationFunction:activationFunction);
      this.neurons.add(temp);
    }
  }

  ///
  /// Returns true if the layer has 1 or more neurons.
  ///

  bool get hasNeurons {
    return this.neurons.isNotEmpty;
  }

  ///
  /// Returns the number of neurons of the layer.
  ///

  int get numNeurons {
    if (this.hasNeurons) {
      return this.neurons.length;
    } else {
      return 0;
    }
  }

  ///
  /// Add a new Neuron.
  ///
  /// If the neuron is null an exception will be thrown.
  ///

  void addNeuron(Neuron neuron) {
    if (neuron == null) {
      throw ("Neuron is empty");
    }
    this.neurons.add(neuron);
  }

  ///
  /// Remove all neurons.
  ///

  void removeAllNeurons() {
    this.neurons = [];
  }

  ///
  /// Remove a neuron at index.
  ///

  void removeNeuronAt(int index) {
    this.neurons.removeAt(index);
  }

  ///
  /// Return a neuron at index.
  ///

  Neuron getNeuron(int index) {
    return this.neurons[index];
  }

  ///
  /// Set a Neuron at index.
  ///

  void setNeuron(int index, Neuron neuron) {

    if (neuron == null) {
      throw ("Neuron is empty");
    }
    this.neurons[index] = neuron;

  }

  ///
  /// Calculate the output of all the neurons of the layer.
  ///

  void calculateOutput() {

    for (Neuron neuron in this.neurons) {
      neuron.calculateOutput();
    }

  }

}