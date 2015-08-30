part of game_client;

class GUIController {

  stagexl.Stage _stage;

  stagexl.Sprite _uiLayer;
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutputField;
  Window _debugWindow;
  Window _chatWindow;

  GUIController(this._stage){
    _stage.onResize.listen(_onResize);
  }

  String get username => _usernameField.text;

  set debugOutput(String debugOutput){
    _debugOutputField.text = debugOutput;
  }


  _onResize(stagexl.Event e){
    _updateChatWindowPosition();
  }


  toggleGUI(){
    _uiLayer.visible = !_uiLayer.visible;
  }

  buildUILayer(stagexl.Stage stage, Function onTapConnect){
    num boxWidth = 150;

    _uiLayer = new stagexl.Sprite();
    _uiLayer.addTo(stage);

    // debug window
    _debugWindow = new Window();
    _debugWindow.width = boxWidth;
    _debugWindow.x = 10;
    _debugWindow.y = 10;
    _debugWindow.addTo(_uiLayer);

    // username
    var usernameCaptionField = UIHelper.createTextField(text: "Username:");
    _debugWindow.pushView(usernameCaptionField);

    _usernameField = UIHelper.createInputField();
    _usernameField.onMouseClick.listen((_) => stage.focus = _usernameField);
    _debugWindow.pushView(_usernameField);

    _debugWindow.pushSpace(5);

    // connect button
    _connectButton = new Button(_debugWindow.contentWidth, Window.buttonHeight)
      ..text = "Hello World";
    _debugWindow.pushView(_connectButton);
    _connectButton.onMouseClick.listen(onTapConnect);

    _debugWindow.pushSpace(10);

    // debug output
    _debugOutputField = UIHelper.createTextField(numLines: 4);
    _debugWindow.pushView(_debugOutputField);

    _debugWindow.pushSpace(10);

  }

  updateConnectButton(int state){
    switch(state){
      case ServerConnectionState.DISCONNECTED:
        _connectButton.text = "Connect";
        break;
      case ServerConnectionState.IS_CONNECTING:
        _connectButton.text = "Connecting...";
        break;
      case ServerConnectionState.CONNECTED:
        _connectButton.text = "Disconnect";
        break;
    }
  }


  addChatWindowToGUI(Window window){
    _chatWindow = window;
    _updateChatWindowPosition();
    window.addTo(_uiLayer);
  }

  _updateChatWindowPosition(){
    num offset = 10;
    _chatWindow.x = offset;
    _chatWindow.width = _stage.stageWidth - offset * 2;
    _chatWindow.y = _stage.stageHeight - _chatWindow.height - offset;
  }
}