part of world_server;

typedef void MessageHandler(ClientProxy client, Message message);

class ClientProxy
{
  final Connection _connection;
  static WorldServer worldServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.CHAT: onChatMessage,
      MessageType.HANDSHAKE: onHandshake,
      MessageType.PLAYER: onPlayerUpdate
    };
  Entity playerEntity;
  
  ClientProxy(this._connection){
    _connection.onReceiveMessage.listen(onMessage);
    _connection.onDisconnectDelegate = _onDisconnect;
  }
  
  _onDisconnect([e]){
    worldServer.disconnectClient(this);
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
      if(message.messageType != null){
        print("affected message type: ${message.messageType}");  
      }
    }
  }
  
  static onChatMessage(ClientProxy client, Message message)
  {
    worldServer.broadcastFromPlayer(client, message);
  }
  
  static onHandshake(ClientProxy client, Message message)
  {
    //create player entity in world
    client.playerEntity = worldServer.registerPlayer(client);
    
    //send all entities
    for(Entity entity in worldServer.world.entities.values){
      if(entity == client.playerEntity) {
        client.send(new Message(MessageType.PLAYER, entity));
      }
      else {
        client.send(new Message(MessageType.ENTITY, entity));        
      }
    }
  }
  
  static onPlayerUpdate(ClientProxy client, Message message){
    Entity entity = new Entity.fromJson(message.payload);

    if(client.playerEntity.id != entity.id){
      print("client attempting to update entity other than itself");
      worldServer.disconnectClient(client);
      return;
    }
    
    worldServer.updatePlayerEntity(client, entity);
  }
}