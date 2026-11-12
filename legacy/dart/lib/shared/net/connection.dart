part of net;

abstract class Connection {
  Stream<Envelope> get onReceiveMessage;
  Function onDisconnectDelegate;
  
  void send(Envelope envelope);
  void disconnect();
}