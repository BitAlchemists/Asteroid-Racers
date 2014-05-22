part of web_client;

class WebSocketServerConnection implements ServerConnection {
  //Private Fields
  html.WebSocket _webSocket;
  String _url;
  
  Completer _onConnectCompleter = new Completer();
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();
  
  //Public properties
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  //ctor
  WebSocketServerConnection(this._url);
  
  //Connection Logic
  Future connect(){
    log("Connecting to Web socket");
    _webSocket = new html.WebSocket(_url);

    bool isConnecting = true;
    
    _webSocket.onOpen.listen((e) {
      log('Connected');
      isConnecting = false;
      _onConnectCompleter.complete();
    });
    
    onDisconnect(e){
      if(isConnecting){
        _onConnectCompleter.completeError(e);
      }
      else
      {
        onDisconnectDelegate();        
      }
    }

    _webSocket.onClose.listen(onDisconnect);
    _webSocket.onError.listen(onDisconnect);

    _webSocket.onMessage.listen(_onReceiveMessage);  
    
    return _onConnectCompleter.future;
  }
 

  void disconnect(){
    _webSocket.close();
    _webSocket = null;
    this.onDisconnectDelegate();
    this.onDisconnectDelegate = null;
  }

  // Message handling
  void send(Message message) {
    String encodedMessage = message.toJson();
    
    if (_webSocket != null && _webSocket.readyState == html.WebSocket.OPEN) {
      _webSocket.send(encodedMessage);
    } else {
      log('WebSocket not connected, message $encodedMessage not sent');
    }
  }
  
  _onReceiveMessage(html.MessageEvent e) {
    Message message = new Message.fromJson(e.data);
    _receiveMessageStreamController.add(message);
  }
}

