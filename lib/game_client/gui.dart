part of game_client;

class GUIController {

  stagexl.Stage _stage;

  stagexl.Sprite _uiLayer;
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutputField;
  Window _debugWindow;
  Window _chatWindow;

  stagexl.Sprite _radar;


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

    _radar = new stagexl.Sprite();
    _radar.graphics.circle(_stage.stageWidth/2, _stage.stageHeight/2, 200);
    _radar.graphics.strokeColor(stagexl.Color.Navy);
    _radar.addTo(_stage);

  }

  updateRadar(EntityController player, Map<EntityController,int> otherEntities){
    _radar.removeChildren();
    for(EntityController ec in otherEntities.keys){

      Vector2 direction = ec.entity.position - player.entity.position;
      direction.normalize().scale(200.0);

      num pointerRadius = 20;

      stagexl.Sprite pointer;
      pointer = new stagexl.Sprite();
      pointer.graphics.circle(_stage.stageWidth/2 + direction.x, _stage.stageHeight/2 + direction.y, pointerRadius);
      pointer.graphics.strokeColor(otherEntities[ec]);
      pointer.addTo(_radar);

      String displayText = "";

      if(ec.entity.displayName != null && ec.entity.displayName != "")
      {
        displayText += ec.entity.displayName + "\n";
      }

      if(ec.entity is Movable){
        Movable movable = ec.entity;
        Vector2 relativeVelocity = (player.entity as Movable).velocity - movable.velocity;
        displayText += "vel x:" + relativeVelocity.x.toStringAsPrecision(4) + "\n";
        displayText += "vel y:" + relativeVelocity.y.toStringAsPrecision(4) + "\n";
      }

      displayText += "Distance: " + (ec.entity.position - player.entity.position).length.toStringAsPrecision(4);

      stagexl.TextField _displayNameTextField = new stagexl.TextField();
      _displayNameTextField.text = displayText;
      _displayNameTextField.textColor = stagexl.Color.LightBlue;
      _displayNameTextField.y = pointerRadius + _stage.stageHeight/2 + direction.y;
      _displayNameTextField.x = - _displayNameTextField.textWidth / 2.0 + _stage.stageWidth/2 + direction.x;
      _displayNameTextField.width = _displayNameTextField.textWidth;
      _displayNameTextField.autoSize = stagexl.TextFieldAutoSize.CENTER;
      pointer.addChild(_displayNameTextField);


    }
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