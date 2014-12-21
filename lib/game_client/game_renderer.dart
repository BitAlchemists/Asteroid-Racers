part of game_client;

class GameRenderer implements stagexl.Animatable  {

  stagexl.Stage get stage => _stage;
  String get username => _usernameField.text;
  set debugOutput(String debugOutput){
    _debugOutputField.text = debugOutput;
  }

  StarBackground _background;
  ParallaxLayer _earthLayer;
  ParallaxLayer _entitiesLayer;
  ParallaxLayer _shipsLayer;
  
  // The stage is our host system. We use it for the heart beat.
  stagexl.Stage _stage;

  //UI
  stagexl.Sprite _uiLayer;
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutputField;
  Window _debugWindow;
  
  GameRenderer(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    
    // Fullscreen
    _stage.scaleMode = stagexl.StageScaleMode.NO_SCALE;
    _stage.align = stagexl.StageAlign.TOP_LEFT;      

    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    _stage.focus = _stage;
    
  }
  

  toggleGUI(){
    _uiLayer.visible = !_uiLayer.visible;
  }
  
  clearScene(){
    
    if(_entitiesLayer != null){
      _entitiesLayer.removeFromParent();
      _entitiesLayer = null;      
    }
    
    if(_background != null){
      _background.removeFromParent();
      _stage.juggler.remove(_background);
      _background = null;
    }
    
    if(_earthLayer != null){
      _earthLayer.removeFromParent();
      _stage.juggler.remove(_earthLayer);
      _earthLayer = null;
    }
    
    if(_shipsLayer != null){
      _shipsLayer.removeFromParent();
      _shipsLayer = null;
    }
  }
  
  buildUILayer(Function onTapConnect){
    num boxWidth = 150;
    
    _uiLayer = new stagexl.Sprite();
    _uiLayer.addTo(_stage);
        
    // debug window
    _debugWindow = new Window(boxWidth);
    _debugWindow.x = 10;
    _debugWindow.y = 10;
    _debugWindow.addTo(_uiLayer);
    
    // username
    var usernameCaptionField = UIHelper.createTextField(text: "Username:");
    _debugWindow.pushView(usernameCaptionField);
    
    _usernameField = UIHelper.createInputField();
    _usernameField.onMouseClick.listen((_) => _stage.focus = _usernameField);
    _debugWindow.pushView(_usernameField);
    
    _debugWindow.pushSpace(5);
    
    // connect button
    _connectButton = new Button(_debugWindow.contentWidth, Window.buttonHeight)
    ..text = "Hello World";
    _debugWindow.pushView(_connectButton);
    _connectButton.onMouseClick.listen(onTapConnect);
    
    _debugWindow.pushSpace(10);
    
    // debug output
    _debugOutputField = UIHelper.createTextField(numLines: 3);
    _debugWindow.pushView(_debugOutputField);
    
    _debugWindow.pushSpace(10);
   
  }
  
  buildBackgroundLayer(){
    //Background
    _background = new StarBackground(2000.0, 2000.0, this);
    _stage.addChildAt(_background, _stage.numChildren);  
    _stage.juggler.add(_background);
    
    //Earth layer
    _earthLayer = new ParallaxLayer(this, 0.3);
    _stage.addChildAt(_earthLayer, _stage.numChildren);
    _stage.juggler.add(_earthLayer);
    
    Planet earth = new Planet(400, stagexl.Color.DarkBlue, stagexl.Color.Green);
    earth.x = -700;
    _earthLayer.addChild(earth);
    
    Planet moon = new Planet(50, stagexl.Color.LightGray, stagexl.Color.DarkGray);
    moon.x = -300;
    moon.y = -300;
    _earthLayer.addChild(moon);      
    
    Satellite satellite = new Satellite();
    satellite.x = 270;
    satellite.y = 150;
    satellite.rotation = 0.5;
    _earthLayer.addChild(satellite);
    _stage.juggler.add(satellite.juggler);      
  }
  
  buildEntitiesLayer(){
    //entities layer
    _entitiesLayer = new ParallaxLayer(this, 1.0);
    _stage.addChildAt(_entitiesLayer, _stage.numChildren);
    _stage.juggler.add(_entitiesLayer);   
    
    // sample space station
    stagexl.Sprite station = StationBuilder.sampleStation();
    station.y = -50;
    station.x = -1200;
    _entitiesLayer.addChild(station);  
    
    // ships layer
    _shipsLayer = new ParallaxLayer(this, 1.0);
    _stage.addChildAt(_shipsLayer, _stage.numChildren);
    _stage.juggler.add(_shipsLayer);
  }
  
  addWindowToGUI(Window window){
    window.x = 10;
    window.y = _debugWindow.y + _debugWindow.height + 10;
    window.addTo(_uiLayer);
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
  
  addEntityDisplayObject(var displayObject){
    _shipsLayer.addChild(displayObject);
  }
  
  removeEntityDisplayObject(var displayObject){
    _shipsLayer.removeChild(displayObject);
  }
}