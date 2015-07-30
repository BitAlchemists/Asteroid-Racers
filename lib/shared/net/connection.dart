part of ar_shared;

abstract class Connection {
  Stream<Envelope> get onReceiveMessage; //todo: rename to onReceiveMessageEnvelope
  Function onDisconnectDelegate;
  
  void send(Envelope envelope);
  void disconnect();
}