library world_server;

import "../shared/ar_shared.dart";

part "client_proxy.dart";

class WorldServer {
  final World _world = new World();
  final List<ClientProxy> _clients = new List<ClientProxy>();

  World get world => _world;
  
  WorldServer(){
    _world.generateAsteroidBelt(500, 2000, 2000);  
    ClientProxy.worldServer = this;
  }
  
  void connectClient(ClientProxy client){
    _clients.add(client);
  }
  
  void disconnectClient(ClientProxy client){
    _clients.remove(client);
  }  
  
  void broadcastFromPlayer(ClientProxy sender, Message message) {
    for(ClientProxy client in _clients) {
      if(client != sender){
        client.send(message);
      }
    }
  }
}
