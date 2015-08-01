part of ai;

class LukeSerializer {
  static Object networkToJson(Luke network){
    List outputLayer = [];

    for(Neuron neuron in network.outputNeurons){
      List jsonNeuron = [];
      outputLayer.add(jsonNeuron);

      for(Connection connection in neuron.inputConnections){
        jsonNeuron.add(connection.weightValue);
      }
    }

    return outputLayer;
  }

  static Luke jsonToNetwork(Object json){
    int inputNeurons = 4;
    List outputLayer = json as List;

    Luke network = new Luke(inputNeurons,outputLayer.length);


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

  static List<Luke> readFromFile() {
    String filePath = Directory.current.path + "/luke";
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
    String filePath = Directory.current.path + "/luke";
    new File(filePath).writeAsStringSync(json);
    print("saved brains");
  }

}