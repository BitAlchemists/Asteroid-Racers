part of world_server;

class ClientProxy
{
  ConnectionHandler _connectionHandler;
  
  ClientProxy(this._connectionHandler){
    _connectionHandler.onMessage.listen(onMessage);
  }
  
  void onMessage(Message message){
    print("ClientProxy getting message $message");
    _connectionHandler.send(message);
  }
}