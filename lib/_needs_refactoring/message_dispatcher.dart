/*

typedef MessageHandler(Envelope envelope);

class MessageDispatcher {
  static final MessageDispatcher _instance = new MessageDispatcher();
  final Map<String, MessageHandler> messageHandlers = new Map<String, MessageHandler>();
  
  static MessageDispatcher get instance {
    return _instance;
  }
 
  MessageDispatcher();
  
  registerHandler(String messageType, MessageHandler messageHandler) {
    messageHandlers[messageType] = messageHandler;
  }
  
  dispatch(Message message) {
    MessageHandler messageHandler = messageHandlers[message.messageType];
    if(messageHandler != null) {
      messageHandler(message);
    }
    else {
      print('could not dispatch message of type "${message.messageType}". No MessageHandler is registered.');
    }
  }
}

*/