part of game_client;

class RacePortalController extends EntityController {
 
  RacePortalController(entity) : super(entity);
  
  _createSprite(RacePortal platform) {    
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