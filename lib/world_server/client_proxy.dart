part of world_server;

typedef void MessageHandler(ClientProxy client, Message message);

class ClientProxy
{
  final Connection _connection;
  static WorldServer worldServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.CHAT: onChatMessage,
      MessageType.REQUEST_ALL_ENTITIES: onRequestAllEntities
    };
  
  ClientProxy(this._connection){
    _connection.onReceiveMessage.listen(onMessage);
  }
  
  void send(Message message) {
    _connection.send(message);
  }
  
  void onMessage(Message message){
    try {      
      if(message.messageType == null) {
        print("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[message.messageType];
      
      if(messageHandler != null){
        messageHandler(this, message);
      }
      else {
        print("no appropriate message handler for messageType ${message.messageType} found.");
      }            
    }
    catch (e)
    {
      print("exception during ClientProxy.onMessage: ${e.toString()}");
    }
  }
  
  static onChatMessage(ClientProxy client, Message message)
  {
    worldServer.broadcastFromPlayer(client, message);
  }
  
  static onRequestAllEntities(ClientProxy client, Message message)
  {
    for(Entity entity in worldServer.world.entities){
      client.send(new Message(MessageType.ENTITY, entity));
    }
  }
}