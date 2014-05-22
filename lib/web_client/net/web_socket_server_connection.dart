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

    _webSocket.onOpen.listen((e) {
      log('Connected');
      _onConnectCompleter.complete();
    });

    _webSocket.onClose.listen((e) => onDisconnectDelegate());
    _webSocket.onError.listen((e) => onDisconnectDelegate());

    _webSocket.onMessage.listen(_onReceiveMessage);  
    
    return _onConnectCompleter.future;
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

