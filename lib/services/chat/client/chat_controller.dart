part of chat_client;

class ChatController {
  MessageInput _messageInput;
  UsernameInput _usernameInput;
  ChatWindow _chatWindow;
  IConnectionHandler _connectionHandler;

  ChatController(IConnectionHandler connectionHandler) {
    
    _connectionHandler = connectionHandler;
    
    TextAreaElement chatElem = querySelector('#chat-display');
    InputElement usernameElem = querySelector('#chat-username');
    InputElement messageElem = querySelector('#chat-message');
    
    _chatWindow = new ChatWindow(chatElem);
    _usernameInput = new UsernameInput(usernameElem);
    _messageInput = new MessageInput(messageElem);
    
    messageElem.onChange.listen((e) {
      Message chatMessage = new Message();
      chatMessage.messageType = MessageType.CHAT;
      chatMessage.payload = {'from': _usernameInput.username, 'message': _messageInput.message};
      _connectionHandler.send(chatMessage);
      _chatWindow.displayMessage(_messageInput.message, _usernameInput.username);
      e.target.value = '';
    });

    usernameElem.onChange.listen((e) {
      if (!e.target.value.isEmpty) {
        _messageInput.enable();
      } else {
        _messageInput.disable();
      }
    });

    MessageDispatcher.instance.registerHandler(MessageType.CHAT, (Message chatMessage){
      Map message = chatMessage.payload;
      _chatWindow.displayMessage(message['message'], message['from']);
    }); 
  }
}