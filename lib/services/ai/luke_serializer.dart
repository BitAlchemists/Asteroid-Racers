part of ai;


/*

  [ [ generation: 1,
      outputLayer:
      [

      ]
  ]


 */

class LukeSerializer {
  static Object networkToJson(Luke network){
    Map raw = {"generation":network.generation, "best_reward":network.best_reward, "name": network.name};
    List outputLayer = [];

    for(Neuron neuron in network.outputNeurons){
      List jsonNeuron = [];
      outputLayer.add(jsonNeuron);

      for(Connection connection in neuron.inputConnections){
        jsonNeuron.add(connection.weightValue);
      }
    }

    raw["outputLayer"] = outputLayer;
    return raw;
  }

  static Luke jsonToNetwork(Object json){
    int inputNeurons = 4;
    Map raw = json as Map;
    List outputLayer = raw["outputLayer"];

    Luke network = new Luke(inputNeurons,outputLayer.length);
    network.generation = raw["generation"];
    network.best_reward = raw["best_reward"];
    network.name = raw["name"];

    for(int neuronIndex = 0; neuronIndex < outputLayer.length; neuronIndex++){
      List neuronJson = outputLayer[neuronIndex];
      Neuron neuron = network.outputNeurons[neuronIndex];

      for(int inputConnectionIndex = 0; inputConnectionIndex < inputNeurons + 1; inputConnectionIndex++)
      {
        Connection connection = neuron.inputConnections[inputConnectionIndex];
        connection.weight.value = neuronJson[inputConnectionIndex];
      }
    }

    return network;
  }

  static String filePath = Directory.current.path + "/luke.txt";

  static List<Luke> readFromFile() {
    File file = new File(filePath);
    if(file.existsSync()){
      String json = file.readAsStringSync();
      Iterable lukes = JSON.decode(json);
      lukes = lukes.map(jsonToNetwork).toList();
      print("loaded brains");
      return lukes;
    }
    return null;
  }

  static void writeToFile(Iterable<Luke> lukes) {
    lukes = lukes.map(networkToJson).toList();
    String json = JSON.encode(lukes);
    new File(filePath).writeAsStringSync(json);
    print("saved brains");
  }

}