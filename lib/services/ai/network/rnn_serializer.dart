part of ai;

class RNNSerializer implements NetworkSerializer {
  Object networkToJson(RNN network){
    if(network is RNN){
      Map raw = {"generation":network.generation, "name": network.name, "id_count": network._idCounter};

      List rawNeuronIDs = <int>[];
      for(Neuron neuron in network.neurons){
        rawNeuronIDs.add(neuron.id);
      }
      raw["neurons"] = rawNeuronIDs;

      List rawConnections = [];
      for(Connection connection in network.connections){
        rawConnections.add(
            [connection.neuronOrigin.id,
            connection.neuronDestination.id,
            connection.weight]);
      }
      raw["connections"] = rawConnections;

      List rawInputIDs = <int>[];
      for(Neuron neuron in network.inputNeurons){
        rawInputIDs.add(neuron.id);
      }
      raw["inputs"] = rawInputIDs;

      List rawOutputIDs = <int>[];
      for(Neuron neuron in network.outputNeurons){
        rawOutputIDs.add(neuron.id);
      }
      raw["outputs"] = rawOutputIDs;

      return raw;
    }
    else {
      throw "this is not an RNN";
    }

    return null;
  }

  RNN jsonToNetwork(Object json){

    Map raw = json as Map;
    String name = raw["name"];
    List rawInputIDs = raw["inputs"];
    List rawOutputIDs = raw["outputs"];

    RNN network = new RNN();
    network.name = raw["name"];
    network.generation = raw["generation"];
    network._idCounter = raw["id_count"];

    List<int> neuronIDs = raw["neurons"];
    Map<int,Neuron> neuronMap = <int,Neuron>{};
    network._neurons.addAll(new Iterable.generate(neuronIDs.length,(i){
      int id = neuronIDs[i];
      Neuron neuron = new Neuron(id, inputFunction: new WeightCombination(), activationFunction: new Tanh());
      neuronMap[id] = neuron;
      return neuron;
    }));

    List rawConnections = raw["connections"];
    for(List rawConnection in rawConnections){
      network.connectNeurons(neuronMap[rawConnection[0]], neuronMap[rawConnection[1]], rawConnection[2]);
    }

    network.inputNeurons.addAll(network._neurons.where((neuron) => rawInputIDs.contains(neuron.id)));
    network.outputNeurons.addAll(network._neurons.where((neuron) => rawOutputIDs.contains(neuron.id)));

    return network;
  }



  List<RNN> readNetworksFromFile(String networkName) {

    Directory directory = new Directory.fromUri(new Uri.file(Directory.current.path + "/db/$networkName"));
    String networksFilePath = directory.path + "/rnn.txt";

    File file = new File(networksFilePath);
    if(file.existsSync()){
      String json = file.readAsStringSync();
      Iterable networks = JSON.decode(json);
      networks = networks.map(jsonToNetwork).toList();
      //print("loaded networks");
      return networks;
    }

    return null;
  }

  void writeNetworksToFile(Iterable<RNN> networks, String networkName) {

    Directory logDirectory = new Directory.fromUri(new Uri.file(Directory.current.path + "/db/$networkName"));
    logDirectory.createSync(recursive:true);
    String networksFilePath = logDirectory.path + "/rnn.txt";

    networks = networks.map(networkToJson).toList();
    String json = JSON.encode(networks);
    new File(networksFilePath).writeAsStringSync(json);
    //print("saved networks");

  }

}