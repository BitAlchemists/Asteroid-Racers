part of web_client;

class LocalConnectionHandler implements Connection {
  Function onReceiveMessageDelegate;
  
  LocalConnectionHandler _inverseConnectionHandler;
  
  ClientProxy _clientProxy; 
  
  LocalConnectionHandler();
  LocalConnectionHandler._inverse(this._inverseConnectionHandler);
  
  Future open(){
    _inverseConnectionHandler = new LocalConnectionHandler._inverse(this);
    ConnectionHandler serverConnectionHandler = new ConnectionHandler(_inverseConnectionHandler);
    _clientProxy = new ClientProxy(serverConnectionHandler);
    return new Future.value();
  }
  
  void send(Message message){
    _inverseConnectionHandler.onReceiveMessageDelegate(message);
  }
}