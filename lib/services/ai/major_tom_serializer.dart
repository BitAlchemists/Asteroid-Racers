part of ai;


/*

  [ [ generation: 1,
      outputLayer:
      [

      ]
  ]


 */

class LukeSerializer {
  static Object networkToJson(MajorTom network){
    Map raw = {"generation":network.generation, "name": network.name};
    // "best_reward":network.best_reward
    List rawLayers = [];
    for(int layerIndex = 1; layerIndex < network.layers.length; layerIndex++){
      Layer layer = network.layers[layerIndex];

      List rawLayer = [];
      rawLayers.add(rawLayer);

      for(Neuron neuron in layer.neurons){
        List rawNeuron = [];
        rawLayer.add(rawNeuron);

        for(Connection connection in neuron.inputConnections){
          rawNeuron.add(connection.weightValue);
        }
      }
    }

    raw["input_neurons_count"] = network.inputNeurons.length;
    raw["layers"] = rawLayers;
    return raw;
  }

  static MajorTom jsonToNetwork(Object json){
    Map raw = json as Map;
    List rawLayers = raw["layers"];

    List layerSizes = [raw["input_neurons_count"]];
    for(List rawLayer in rawLayers){
      layerSizes.add(rawLayer.length);
    }

    MajorTom network = new MajorTom(layerSizes);
    network.generation = raw["generation"];
    //network.best_reward = raw["best_reward"];
    network.name = raw["name"];


    for(int layerIndex = 0; layerIndex < rawLayers.length; layerIndex++){

      List rawLayer = rawLayers[layerIndex];
      Layer layer = network.layers[layerIndex+1];
      Layer previousLayer = network.layers[layerIndex];


      for(int neuronIndex = 0; neuronIndex < rawLayer.length; neuronIndex++){
        List rawNeuron = rawLayer[neuronIndex];
        Neuron neuron = layer.neurons[neuronIndex];

        for(int inputConnectionIndex = 0; inputConnectionIndex < previousLayer.neurons.length + 1; inputConnectionIndex++)
        {
          Connection connection = neuron.inputConnections[inputConnectionIndex];
          connection.weight.value = rawNeuron[inputConnectionIndex];
        }
      }

    }


    return network;
  }

  static String networksFilePath = Directory.current.path + "/luke.txt";

  static List<MajorTom> readNetworksFromFile() {
    File file = new File(networksFilePath);
    if(file.existsSync()){
      String json = file.readAsStringSync();
      Iterable lukes = JSON.decode(json);
      lukes = lukes.map(jsonToNetwork).toList();
      print("loaded networks");
      return lukes;
    }
    return null;
  }

  static void writeNetworksToFile(Iterable<MajorTom> lukes) {
    lukes = lukes.map(networkToJson).toList();
    String json = JSON.encode(lukes);
    new File(networksFilePath).writeAsStringSync(json);
    print("saved networks");
  }

  static String historiesFilePath = Directory.current.path + "/luke.txt";

}