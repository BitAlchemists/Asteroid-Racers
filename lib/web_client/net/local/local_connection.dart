part of web_client;

class LocalConnection implements Connection {
  Function onReceiveMessageDelegate;
  
  LocalConnection _inverseConnectionHandler;
  
  ClientProxy _clientProxy; 
  
  LocalConnection();
  LocalConnection._inverse(this._inverseConnectionHandler);
  
  Future open(){
    _inverseConnectionHandler = new LocalConnection._inverse(this);
    ConnectionHandler serverConnectionHandler = new ConnectionHandler(_inverseConnectionHandler);
    _clientProxy = new ClientProxy(serverConnectionHandler);
    return new Future.value();
  }
  
  void send(Message message){
    _inverseConnectionHandler.onReceiveMessageDelegate(message);
  }
}