part of tcp_server;

class WebSocketClientConnection implements Connection {
  
  // Private Fields
  final WebSocket _webSocket;
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();

  // Public Properties
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  
  // ctor
  WebSocketClientConnection(this._webSocket)
  {
    _webSocket.listen(_onReceiveMessage
    //,
    //      onDone: () => _connections.remove(webSocket),
    //      onError: (e) => _connections.remove(webSocket)
    );
  }
  
  // Message Handling
  void send(Message message)
  {
    queue((){
      try {
        String encodedMessage = message.toJson();
        _webSocket.add(encodedMessage); 
      }
      catch (e)
      {
        print("error during send()ing message: ${e.toString()}");
      }   
    });        
  }
  
  void _onReceiveMessage(String encodedMessage){
    try {
      Message message = new Message.fromJson(encodedMessage);
      _receiveMessageStreamController.add(message);      
    }
    catch(e){
      print("error during _onReceiveMessage: ${e.toString()}");
    }
  }
}

