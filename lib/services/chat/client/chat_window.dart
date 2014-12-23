part of chat_client;

class ChatWindow extends Window {
  stagexl.TextField _chatInput;
  stagexl.TextField get chatInput => _chatInput;
  
  stagexl.TextField _chatOutput;
  stagexl.TextField get chatOutput => _chatOutput;
  
  ChatWindow() : super(250){
    _chatInput = UIHelper.createInputField();
    _chatInput.onMouseClick.listen((_) => this.stage.focus = _chatInput);
    this.pushView(_chatInput);
    _chatOutput = UIHelper.createTextField(numLines:5);
    this.pushView(_chatOutput);
  }
}