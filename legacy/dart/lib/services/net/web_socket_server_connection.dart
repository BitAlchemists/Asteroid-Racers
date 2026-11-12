library net.connection.server.web_socket;

import "dart:html" as html;
import "dart:async";
import "dart:typed_data";

import "package:logging/logging.dart" as logging;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/services/net/server_connection.dart";

class WebSocketServerConnection implements ServerConnection {
  //Private Fields
  html.WebSocket _webSocket;
  String _url;
  bool _isConnecting = false;
  
  Completer _onConnectCompleter = new Completer();
  final StreamController<Envelope> _receiveMessageStreamController = new StreamController<Envelope>.broadcast();
  
  //Public properties
  Stream<Envelope> get onReceiveMessage => _receiveMessageStreamController.stream;
  Function onDisconnectDelegate;
  logging.Logger log = new logging.Logger("GameClient.Net.WebSocketServerConnection");
  
  //ctor
  WebSocketServerConnection(this._url);
  
  //Connection Logic
  Future connect(){
    //log("Connecting to Web socket");
    _webSocket = new html.WebSocket(_url);
    _webSocket.binaryType = "arraybuffer";
    
    _webSocket.onOpen.listen(_onConnected);
    _webSocket.onClose.listen(_onDisconnected);
    _webSocket.onError.listen(_onDisconnected);

    _webSocket.onMessage.listen(_onReceiveMessage);  
    
    return _onConnectCompleter.future;
  }
 
  _onConnected(e) {
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
      _isConnecting = false;
      _onConnectCompleter.completeError(e);
      _onConnectCompleter = null;
    }
    else
    {
      onDisconnectDelegate();
    }
  }

  // Message handling
  void send(Envelope envelope) {
    List<int> encodedMessage = envelope.writeToBuffer();
    
    if (_webSocket != null && _webSocket.readyState == html.WebSocket.OPEN) {
      _webSocket.send(encodedMessage);
    } else {
      log.warning('WebSocket not connected, message $encodedMessage not sent');
    }
  }
  
  _onReceiveMessage(html.MessageEvent e) {
    //print("onReceiveMessage");
    Uint8List encodedEnvelope = (e.data as ByteBuffer).asUint8List();
    Envelope envelope = new Envelope.fromBuffer(encodedEnvelope);
    _receiveMessageStreamController.add(envelope);
  }
}

