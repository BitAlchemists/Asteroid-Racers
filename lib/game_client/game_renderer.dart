part of game_client;

/**
 * This class takes care of presenting the visual game content to the player.
 * 
 * It is used by GameClient.
 */
class GameRenderer implements stagexl.Animatable {

  stagexl.Stage get stage => _stage;

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
  
  stagexl.Sprite playerSprite; /// This variable is used to update the offset of the parallax layers each fra

  Satellite _satellite;
  /// The stage is our host system. We use it for the heart beat.
  stagexl.Stage _stage;

  GUIController gui;

  List<EntityController> _updateSpriteList = [];

  GameRenderer(html.CanvasElement canvas){
    _stage = new stagexl.Stage(canvas);
    _stage.juggler.add(this);
    
    // Fullscreen
    _stage.scaleMode = stagexl.StageScaleMode.NO_SCALE;
    _stage.align = stagexl.StageAlign.TOP_LEFT;      

    _stage.backgroundColor = stagexl.Color.Black;
    _stage.doubleClickEnabled = true;
    _stage.focus = _stage;


    gui = new GUIController(_stage);
  }

  bool advanceTime(num dt){

    for(EntityController ec in _updateSpriteList){
      ec.updateSprite();
    }
    _updateSpriteList.clear();


    if(playerSprite != null){
      Vector2 position = new Vector2(playerSprite.x, playerSprite.y);
      this._updateParallaxOffsets(position);


    _satellite.juggler.advanceTime(dt);

    for(ParallaxLayer layer in _parallaxLayers){
      layer.advanceTime(dt);
    }
 }
    return true;
  }

  toggleGUI(){
    gui.toggleGUI();
  }
  
  clearScene(){
    for(ParallaxLayer layer in _parallaxLayers){
      layer.removeFromParent();
    }
    
    _entitiesLayer = null;      
    _background = null;
    _earthLayer = null;
    _playerLayer = null;
  }

  buildUILayer(Function onTapConnect){
    gui.buildUILayer(stage, onTapConnect);
  }
  
  buildBackgroundLayer(){
    
    //Background
    _background = new StarBackground(2000.0, 2000.0, _stage);
    _stage.addChildAt(_background, 0); ;
    _parallaxLayers.add(_background);
    
    //Earth layer
    _earthLayer = new ParallaxLayer(_stage, 0.3);
    _stage.addChildAt(_earthLayer, 1);
    _parallaxLayers.add(_earthLayer);
    
    Planet earth = new Planet(400, stagexl.Color.DarkBlue, stagexl.Color.Green);
    earth.x = -700;
    _earthLayer.addChild(earth);
    
    Planet moon = new Planet(50, stagexl.Color.LightGray, stagexl.Color.DarkGray);
    moon.x = -300;
    moon.y = -300;
    _earthLayer.addChild(moon);      
    
    _satellite = new Satellite();
    _satellite.x = 270;
    _satellite.y = 150;
    _satellite.rotation = 0.5;
    _earthLayer.addChild(_satellite);
  }
  
  buildEntitiesLayer(){
    //entities layer
    _entitiesLayer = new ParallaxLayer(_stage, 1.0);
    _stage.addChildAt(_entitiesLayer, _stage.numChildren-1);
    _parallaxLayers.add(_entitiesLayer);
    
    // sample space station
    stagexl.Sprite station = StationBuilder.sampleStation();
    station.y = -50;
    station.x = -1200;
    _entitiesLayer.addChild(station);  
    
    //entities layer
    _playerLayer = new ParallaxLayer(_stage, 1.0);
    _stage.addChildAt(_playerLayer, _stage.numChildren-1);
    _parallaxLayers.add(_playerLayer);
    
//    _uiLayer.removeFromParent();
//    _stage.addChild(_uiLayer);
  
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

  updateSpriteInNextFrame(EntityController ec){
    _updateSpriteList.add(ec);
  }
}