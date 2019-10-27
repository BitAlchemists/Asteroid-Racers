part of ai;


abstract class NetworkSerializer {
  Object networkToJson(NeuralNetwork network);
  NeuralNetwork jsonToNetwork(Object json);
  List<NeuralNetwork> readNetworksFromFile(String networkName);
  void writeNetworksToFile(Iterable<NeuralNetwork> networks, String networkName);
}