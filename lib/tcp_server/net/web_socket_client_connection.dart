part of tcp_server;

class WebSocketClientConnection implements Connection {
  
  // Private Fields
  final WebSocket _webSocket;
  final StreamController<Envelope> _receiveEnvelopeStreamController = new StreamController<Envelope>.broadcast();

  // Public Properties
  Stream<Envelope> get onReceiveMessage => _receiveEnvelopeStreamController.stream;
  Function onDisconnectDelegate;
  
  // ctor
  WebSocketClientConnection(this._webSocket)
  {
    _webSocket.listen(_onReceiveEnvelope, onDone: _onDisconnect, onError: _onDisconnect);
  }
  
  disconnect(){
    _webSocket.close();
  }
  
  _onDisconnect([e]){
    this.onDisconnectDelegate(e);
    this.onDisconnectDelegate = null;
  }
  
  // Message Handling
  void send(Envelope envelope)
  {
    queue((){
      try {
        List<int> encodedMessage = envelope.writeToBuffer();
        _webSocket.add(encodedMessage); 
      }
      catch (e)
      {
        print("error during send()ing message: ${e.toString()}");
      }   
    });        
  }
  
  void _onReceiveEnvelope(List<int> encodedEnvelope){
    try {
      Envelope envelope = new Envelope.fromBuffer(encodedEnvelope);
      _receiveEnvelopeStreamController.add(envelope);
    }
    catch(e){
      print("error during _onReceiveMessage: ${e.toString()}");
    }
  }
}

