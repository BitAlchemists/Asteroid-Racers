part of chat_client;

class ChatWindow extends Window {
  stagexl.TextField _chatInput;
  stagexl.TextField get chatInput => _chatInput;
  
  stagexl.TextField _chatOutput;
  stagexl.TextField get chatOutput => _chatOutput;
  
  ChatWindow() : super(){
    width = 250;

    _chatOutput = UIHelper.createTextField(numLines:5);
    this.pushView(_chatOutput);

    _chatInput = UIHelper.createInputField(numLines:1);
    _chatInput.onMouseClick.listen((_) => this.stage.focus = _chatInput);
    this.pushView(_chatInput);

    this.pushSpace(10);
  }

  set width(num width){
    super.width = width;
    if(_chatInput != null){
      updateViewWidth(_chatInput);
    }
    if(_chatOutput != null){
      updateViewWidth(_chatOutput);
    }
  }
}