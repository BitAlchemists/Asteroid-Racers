part of web_client;

class WebSocketServerConnection implements ServerConnection {
  //Private Fields
  html.WebSocket _webSocket;
  String _url;
  bool _isConnecting = false;
  
  Completer _onConnectCompleter = new Completer();
  final StreamController<Message> _receiveMessageStreamController = new StreamController<Message>.broadcast();
  
  //Public properties
  Stream<Message> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  
  //ctor
  WebSocketServerConnection(this._url);
  
  //Connection Logic
  Future connect(){
    //log("Connecting to Web socket");
    _webSocket = new html.WebSocket(_url);
    
    _webSocket.onOpen.listen(_onConnected);
    _webSocket.onClose.listen(_onDisconnected);
    _webSocket.onError.listen(_onDisconnected);

    _webSocket.onMessage.listen(_onReceiveMessage);  
    
    return _onConnectCompleter.future;
  }
 
  _onConnected(e) {
    log('Connected');
    _isConnecting = false;
    _onConnectCompleter.complete();
    _onConnectCompleter = null;
  }
  
  void disconnect(){
    _webSocket.close();
    _webSocket = null;
  }
  
  _onDisconnected(e){
    if(_isConnecting){
      log("Could not connect");
      _isConnecting = false;
      _onConnectCompleter.completeError(e);
      _onConnectCompleter = null;
    }
    else
    {
      log("Disconnected");
      onDisconnectDelegate();        
    }
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
    //print("onReceiveMessage");
    Message message = new Message.fromJson(e.data);
    _receiveMessageStreamController.add(message);
  }
}

