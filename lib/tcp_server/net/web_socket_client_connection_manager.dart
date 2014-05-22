part of tcp_server;

class WebSocketClientConnectionManager {
  //final Set<WebSocketClientConnection> _connections = new Set<WebSocketClientConnection>();
  final StreamController _sc = new StreamController();
  final WorldServer _worldServer;
  
  WebSocketClientConnectionManager(this._worldServer) {
    //String basePath
    //String loggingPath = basePath.append('logs/connection-log.txt');
    //log.initLogging(loggingPath);
    _sc.stream.transform(new WebSocketTransformer()).listen(onConnection);
  }

  void onConnectionRequest(HttpRequest request){
    //we will hand over new connections to the connectionHandler.onConnection method
    _sc.add(request);
  }
  
  void onConnection(WebSocket webSocket) {
    
    Connection connection = new WebSocketClientConnection(webSocket);
    ClientProxy clientProxy = new ClientProxy(connection);
    _worldServer.connectClient(clientProxy);    
  }
}