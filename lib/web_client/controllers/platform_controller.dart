part of web_client;

class PlatformController extends EntityController {
 
  PlatformController(entity) : super(entity){

  }
  
  _createSprite(LaunchPlatform platform) {    
    sprite.graphics.circle(0,0,platform.radius);
    sprite.graphics.fillColor(0x4000ff00);
    
    for(Entity startPosition in platform.positions){
      stagexl.Sprite startPositionSprite = new stagexl.Sprite();
      startPositionSprite.graphics.circle(startPosition.position.x, startPosition.position.y, startPosition.radius);
      startPositionSprite.graphics.fillColor(stagexl.Color.Gray);
      sprite.addChild(startPositionSprite);      
    }
  }
}