library world_server;

import "../shared/ar_shared.dart";

part "client_proxy.dart";

class WorldServer {
  World _world = new World();
  final List<ClientProxy> _clients = new List<ClientProxy>();

  WorldServer(){
    _world.generateAsteroidBelt(500, 2000, 2000);  
  }
  
  void connectClient(ClientProxy client){
    _clients.add(client);
  }
  
  void disconnectClient(ClientProxy client){
    _clients.remove(client);
  }
  
}
