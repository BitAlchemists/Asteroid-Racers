part of ai;

abstract class NeuralNetwork {
  String name;
  int generation = 0;

  List<Neuron> get inputNeurons;
  List<Neuron> get outputNeurons;

  NeuralNetwork();
  NeuralNetwork.generate(Object configuration, String name);

  ///
  /// Set the input value of the input neurons.
  ///
  set inputNetwork(List<double> inputs) {
    if (inputs.length != this.inputNeurons.length) {
      throw ("Array length distinct");
    }
    int i = 0;
    for (Neuron neuron in this.inputNeurons) {
      neuron.input = inputs[i];
      i++;
    }
  }

  ///
  /// Return the output of the outputs neurons.
  ///
  List<double> get outputNetwork {
    List <double> output = [];
    for (Neuron neuron in this.outputNeurons) {
      output.add(neuron.output);
    }
    return output;
  }
}

abstract class InputFunction {
  /// From a list of input connections calculates the total input for the neuron.
  double getOutput(List<Connection> inputConnections);
}

class WeightCombination implements InputFunction {

  ///
  /// Linear combination of weights and inputs.
  ///

  double getOutput(List<Connection> inputConnections) {

    double output = 0.0;
    for (Connection connection in inputConnections) {
      output += connection.neuronOrigin.output * connection.weight;
    }
    return output;

  }

}

class RNN extends NeuralNetwork {
  String name;

  int _idCounter = 0;
  final List<Neuron> _neurons = new List<Neuron>();
  List<Neuron> get neurons => _neurons;
  final List<Neuron> _inputs = new List<Neuron>();
  List<Neuron> get inputNeurons => _inputs;
  final List<Neuron> _outputs = new List<Neuron>();
  List<Neuron> get outputNeurons => _outputs;
  final List<Connection> _connections = new List<Connection>();
  List<Connection> get connections => _connections;
  Neuron _bias;

  RNN();

  RNN.generate(List<int> configuration, name) : super.generate(configuration, name){
    _bias = createNeuron();
    int inputCount = configuration[0];
    int outputCount = configuration[1];

    _inputs.addAll(new List<Neuron>.generate(inputCount, (_)=>createNeuron()));
    _outputs.addAll(new List<Neuron>.generate(outputCount, (_)=>createNeuron()));

    for(Neuron inputNeuron in _inputs){
      for(Neuron outputNeuron in _outputs){
        connectNeurons(inputNeuron, outputNeuron, 1.0);
      }
    }
  }

  Neuron createNeuron(){
    Neuron neuron = new Neuron(_idCounter++, inputFunction: new WeightCombination(), activationFunction: new Tanh());
    _neurons.add(neuron);
    return neuron;
  }

  Connection connectNeurons(Neuron origin, Neuron destination, double weight){
    Connection connection = new Connection(origin, destination, weight);
    _connections.add(connection);
    origin.addOutputConnection(connection);
    destination.addInputConnection(connection);
    return connection;
  }

  disconnectNeurons(Connection connection){
    connection.neuronOrigin.removeOutputConnection(connection);
    connection.neuronDestination.removeInputConnection(connection);
    _connections.remove(connection);
  }

  void calculateOutput() {
    for(Neuron neuron in _neurons){
      neuron.input = neuron.inputFunction.getOutput(neuron.inputConnections);
    }

    for(Neuron neuron in _neurons){
      neuron.output = neuron.activationFunction.getOutput(neuron.input);
    }
  }

  mutate(){
    Math.Random random = new Math.Random.secure();
    double randomValue = random.nextDouble();
    if(randomValue < 0.6){
      double MUTATION_RATE = 0.1;
      double MUTATION_STRENGTH = 1.0;
      mutateWeights(MUTATION_RATE, MUTATION_STRENGTH);
    }
    else if(randomValue < 0.7){
      mutateAddConnection();
    }
    else if(randomValue < 0.8){
      mutateRemoveConnection();
    }
    else if(randomValue < 0.9){
      mutateAddNeuron();
    }
    else {
      mutateRemoveNeuron();
    }
  }

  mutateWeights(double mutationRate, double mutationStrength){
    for(Connection connection in _connections){
      if (random.nextDouble() < mutationRate) {
        connection.weight *= 1 + mutationStrength * (random.nextDouble() * 2 - 1);
        //if a connection weight is smaller than 0.001, it may change sign
        if(connection.weight.abs() < 0.001) {
          if(random.nextDouble() > 0.5) connection.weight *= -1;
        }
      }
    }
  }

  mutateAddConnection(){
    //try 10 times if you can pick a random connection that does not exist
    for(int i = 0; i < 10; i++){
      int originIndex = random.nextInt(_neurons.length);
      int destinationIndex = random.nextInt(_neurons.length);
      Neuron origin = _neurons[originIndex];
      Neuron destination = _neurons[destinationIndex];
      double weight = (random.nextDouble()-0.5)/500;

      //test if that connection exists
      Connection testConnection = new Connection(origin, destination, null);
      if(_connections.contains(testConnection)) continue;

      connectNeurons(origin, destination, weight);
    }
  }

  mutateRemoveConnection(){
    int connectionIndex = random.nextInt(_connections.length);
    Connection connection = _connections[connectionIndex];
    disconnectNeurons(connection);
  }

  mutateAddNeuron(){
    Neuron newNeuron = createNeuron();

    int originIndex = random.nextInt(_neurons.length);
    int destinationIndex = random.nextInt(_neurons.length);
    Neuron origin = _neurons[originIndex];
    Neuron destination = _neurons[destinationIndex];

    double weight = (random.nextDouble()-0.5)/500;
    connectNeurons(origin, newNeuron, weight);

    weight = (random.nextDouble()-0.5)/500;
    connectNeurons(newNeuron, destination, weight);
  }

  mutateRemoveNeuron(){
    List<Neuron> removableNeurons = new List<Neuron>.from(_neurons);
    removableNeurons.removeWhere((neuron)=> inputNeurons.contains(neuron));
    removableNeurons.removeWhere((neuron)=> outputNeurons.contains(neuron));

    if(removableNeurons.length == 0) return;

    int neuronIndex = random.nextInt(removableNeurons.length);
    Neuron neuron = removableNeurons[neuronIndex];

    List inputConnections = new List.from(neuron.inputConnections); // to avoid concurrent manipulation
    for(Connection connection in inputConnections){
      disconnectNeurons(connection);
    }

    List outputConnections = new List.from(neuron.outputConnections); // to avoid concurrent manipulation
    for(Connection connection in outputConnections){
      disconnectNeurons(connection);
    }
    _neurons.remove(neuron);
  }
}

class Neuron {

  int id;
  final List<Connection> _inputConnections = new List<Connection>();
  List<Connection> get inputConnections => _inputConnections;
  final List<Connection> _outputConnections = new List<Connection>();
  List<Connection> get outputConnections => _outputConnections;
  double input = 0.0;
  double output = 0.0;
  ActivationFunction activationFunction;
  InputFunction inputFunction;

  Neuron(this.id, {InputFunction inputFunction, ActivationFunction activationFunction}) {

    if (inputFunction != null) {
      this.inputFunction = inputFunction;
    }
    if (activationFunction != null) {
      this.activationFunction = activationFunction;
    }
  }



  addInputConnection(Connection connection) {
    _inputConnections.add(connection);
  }

  removeInputConnection(Connection connection) {
    _inputConnections.remove(connection);
  }

  addOutputConnection(Connection connection) {
    _outputConnections.add(connection);
  }

  removeOutputConnection(Connection connection) {
    _outputConnections.remove(connection);
  }

  bool operator ==(o) => o is Neuron && id == o.id;

  int get hashCode => id.hashCode;

}



class Connection {
  Neuron neuronOrigin;
  Neuron neuronDestination;
  double weight;

  Connection(this.neuronOrigin, this.neuronDestination, this.weight);

  bool operator ==(o) =>
      o is Connection &&
          neuronOrigin == o.neuronOrigin &&
          neuronDestination == o.neuronDestination;

  int get hashCode => neuronOrigin.hashCode^neuronDestination.hashCode;

}