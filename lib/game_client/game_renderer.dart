part of game_client;

/**
 * This class takes care of presenting the visual game content to the player.
 * 
 * It is used by GameClient.
 */
class GameRenderer implements stagexl.Animatable {

  stagexl.Stage get stage => _stage;
  String get username => _usernameField.text;
  set debugOutput(String debugOutput){
    _debugOutputField.text = debugOutput;
  }

  /// A list of all our layers, used for iterating over them
  List _parallaxLayers = [];
  
  /// The background layer containing the star field.
  StarBackground _background;
  
  /// The layer containing earth and the moon
  ParallaxLayer _earthLayer;
  
  /// This layer has all of the entities
  ParallaxLayer _entitiesLayer;
  
  /// This layer only holds the player, so that the player is always in front of other things in the scene
  ParallaxLayer _playerLayer;
  
  stagexl.Sprite playerSprite; /// This variable is used to update the offset of the parallax layers each frame
    
  /// The stage is our host system. We use it for the heart beat.
  stagexl.Stage _stage;

  //UI
  stagexl.Sprite _uiLayer;
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutputField;
  Window _debugWindow;
  
  GameRenderer(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    _stage.juggler.add(this);
    
    // Fullscreen
    _stage.scaleMode = stagexl.StageScaleMode.NO_SCALE;
    _stage.align = stagexl.StageAlign.TOP_LEFT;      

    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    _stage.focus = _stage;
    
  }
  
  bool advanceTime(num dt){
    if(playerSprite != null){
      Vector2 position = new Vector2(playerSprite.x, playerSprite.y);
      this._updateParallaxOffsets(position);
    }
    return true;
  }

  toggleGUI(){
    _uiLayer.visible = !_uiLayer.visible;
  }
  
  clearScene(){
    for(ParallaxLayer layer in _parallaxLayers){
      layer.removeFromParent();
      _stage.juggler.remove(layer);
    }
    
    _entitiesLayer = null;      
    _background = null;
    _earthLayer = null;
    _playerLayer = null;
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
    _debugOutputField = UIHelper.createTextField(numLines: 4);
    _debugWindow.pushView(_debugOutputField);
    
    _debugWindow.pushSpace(10);
   
  }
  
  buildBackgroundLayer(){
    //Background
    _background = new StarBackground(2000.0, 2000.0, _stage);
    _stage.addChildAt(_background, 0);  
    _stage.juggler.add(_background);
    _parallaxLayers.add(_background);
    
    //Earth layer
    _earthLayer = new ParallaxLayer(_stage, 0.3);
    _stage.addChildAt(_earthLayer, 0);
    _stage.juggler.add(_earthLayer);
    _parallaxLayers.add(_earthLayer);
    
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
    _entitiesLayer = new ParallaxLayer(_stage, 1.0);
    _stage.addChildAt(_entitiesLayer, _stage.numChildren);
    _stage.juggler.add(_entitiesLayer);   
    _parallaxLayers.add(_entitiesLayer);
    
    // sample space station
    stagexl.Sprite station = StationBuilder.sampleStation();
    station.y = -50;
    station.x = -1200;
    _entitiesLayer.addChild(station);  
    
    //entities layer
    _playerLayer = new ParallaxLayer(_stage, 1.0);
    _stage.addChildAt(_playerLayer, _stage.numChildren);
    _stage.juggler.add(_playerLayer);   
    _parallaxLayers.add(_playerLayer);
  
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
  
  addEntityFromController(EntityController ec){
    
    if(ec is PlayerController){
      _playerLayer.addChild(ec.sprite);
      _playerLayer.addChild(ec.particleEmitter);
    }
    else
    {
      _entitiesLayer.addChild(ec.sprite);
    }
  }
  
  removeEntityFromController(EntityController ec){
    ec.sprite.removeFromParent();
    
    if(ec is PlayerController){
      //TE: as of 2014-12-21, this should never happen, since the player entity is only
      // repositioned by the server but not removed. It is only removed when a player disconnects
      ec.particleEmitter.removeFromParent();
    }
  }
  
  _updateParallaxOffsets(Vector2 parallaxOffset){
    for(ParallaxLayer layer in _parallaxLayers){
      layer.parallaxOffset = parallaxOffset;
    }
  }
}