part of tcp_server;

class WebSocketClientConnection implements Connection {
  
  // Private Fields
  final WebSocket _webSocket;
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();

  // Public Properties
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  // ctor
  WebSocketClientConnection(this._webSocket)
  {
    _webSocket.listen(_onReceiveMessage, onDone: _onDisconnect, onError: _onDisconnect);
  }
  
  disconnect(){
    _webSocket.close();
  }
  
  _onDisconnect([e]){
    this.onDisconnectDelegate(e);
    this.onDisconnectDelegate = null;
  }
  
  // Message Handling
  void send(Message message)
  {
    queue((){
      try {
        List<int> encodedMessage = message.writeToBuffer();
        _webSocket.add(encodedMessage); 
      }
      catch (e)
      {
        print("error during send()ing message: ${e.toString()}");
      }   
    });        
  }
  
  void _onReceiveMessage(List<int> encodedMessage){
    try {
      Message message = new Message.fromBuffer(encodedMessage);
      _receiveMessageStreamController.add(message);      
    }
    catch(e){
      print("error during _onReceiveMessage: ${e.toString()}");
    }
  }
}

