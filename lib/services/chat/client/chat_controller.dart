part of chat_client;

class ChatController {
  MessageInput _messageInput;
  UsernameInput _usernameInput;
  ChatWindow _chatWindow;

  ChatController() {
    TextAreaElement chatElem = query('#chat-display');
    InputElement usernameElem = query('#chat-username');
    InputElement messageElem = query('#chat-message');
    _chatWindow = new ChatWindow(chatElem);
    _usernameInput = new UsernameInput(usernameElem);
    _messageInput = new MessageInput(messageElem);
    
    messageElem.onChange.listen((e) {
      Message chatMessage = new Message();
      chatMessage.payload = {'from': _usernameInput.username, 'message': _messageInput.message};
      connectionHandler.send(chatMessage);
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


    MessageDispatcher.instance.registerHandler('chat', (Message chatMessage){
      Map message = chatMessage.payload;
      _chatWindow.displayMessage(message['m'], message['f']);
    });
    
    ClientLogger.instance.stdout.listen((String message) {
      _chatWindow.displayNotice(message);
    });  
  }
}