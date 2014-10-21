part of chat_client;

/*
 * 
  * 
  *   displayMessage(String msg, String from) {
    _display("$from: $msg\n");
  }

  displayNotice(String notice) {
    _display("[system]: $notice\n");
  }

  _display(String str) {
    elem.text = "${elem.text}$str";
  }
 */

class ChatController {

  final StreamController _sendChatMessageStreamController = new StreamController();
  
  Stream get onSendChatMesage => _sendChatMessageStreamController.stream;
  String get messageType => MessageType.CHAT; 
  
  String username;
  stagexl.TextField _chatOutput;

  ChatController(stagexl.TextField chatInput, stagexl.TextField chatOutput) {
            
    _chatOutput = chatOutput;
    
    chatInput.onKeyDown.listen((stagexl.KeyboardEvent e) {
      if(e.keyCode == html.KeyCode.ENTER){
        Message chatMessage = new Message(MessageType.CHAT);
        chatMessage.payload = {'from': username, 'message': chatInput.text};
   
        _sendChatMessageStreamController.add(chatMessage);
        
        displayMessage(chatInput.text, username);
        
        chatInput.text = '';        
      }
    });

    MessageDispatcher.instance.registerHandler(MessageType.CHAT, (Message chatMessage){
      Map message = chatMessage.payload;
      displayMessage(message['message'], message['from']);
    }); 
  }
  
  onReceiveMessage(Message message) {
    Map chatMessage = message.payload;
    displayMessage(chatMessage['message'], chatMessage['from']);
  }
  
  onReceiveLogMessage(String message) {
    displayMessage(message, "system");
  }
  
  displayMessage(String msg, String from) {
   _display("$from: $msg\n");
 }

 displayNotice(String notice) {
   _display("[system]: $notice\n");
 }

 _display(String str) {
   _chatOutput.text = "$str${_chatOutput.text}";
 }
}