part of server;

class ConnectionHandler {
  Set<WebSocket> webSockets = new Set<WebSocket>();

  ConnectionHandler(Path basePath) {
    Path loggingPath = basePath.append('connection-log.txt');
    log.initLogging(loggingPath);
  }

  // closures!
  onConnection(WebSocket webSocket) {
    void onMessage(message) {
      print('new ws msg: $message');
      webSockets.forEach((WebSocket aWebSocket) {
        if (webSocket != aWebSocket) {
          print('queued msg to be sent');
          queue(() => aWebSocket.add(message));
        }
      });
      time('send to isolate', () => log.log(message));
    }
    
    print('new ws conn');
    webSockets.add(webSocket);
    webSocket.listen(onMessage,
      onDone: () => webSockets.remove(webSocket),
      onError: (e) => webSockets.remove(webSocket)
    );
  }
}

/*
      webSocketConnections.forEach((connection) {
        if (conn != connection) {
          print('queued msg to be sent');
          queue(() => connection.send(message));
        }
      });

*/