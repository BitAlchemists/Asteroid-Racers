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
  MessageType get messageType => MessageType.CHAT;
  
  String username;
  stagexl.TextField _chatOutput;

  ChatController(stagexl.TextField chatInput, stagexl.TextField chatOutput) {
            
    _chatOutput = chatOutput;
    
    chatInput.onKeyDown.listen((stagexl.KeyboardEvent e) {
      if(e.keyCode == html.KeyCode.ENTER){
        ChatMessage chatMessage = new ChatMessage();
        chatMessage.text = chatInput.text;

        Message message = new Message();
        message.messageType = MessageType.CHAT;
        message.payload = chatMessage.writeToBuffer();
   
        _sendChatMessageStreamController.add(message);
                
        chatInput.text = '';        
      }
    });
  }
  
  onReceiveMessage(Message message) {
    ChatMessage chatMessage = new ChatMessage.fromBuffer(message.payload);
    displayMessage(chatMessage.text, chatMessage.from);
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