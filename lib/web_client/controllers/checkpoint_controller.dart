part of web_client;

class CheckpointController extends EntityController {
  
  CheckpointController(entity) : super(entity);
  
  updateSprite(){
    sprite.graphics.clear();
    RenderHelper.applyCircle(sprite, entity.radius);
    
    super.updateSprite();
    switch(entity.state)
    {
      case CheckpointState.CLEARED:
        sprite.graphics.strokeColor(stagexl.Color.Green);        
        break;
        
      case CheckpointState.CURRENT:
        sprite.graphics.strokeColor(stagexl.Color.Yellow);
        break;
        
      case CheckpointState.FUTURE:
        sprite.graphics.strokeColor(stagexl.Color.Red);
        break;
        
      default:
        sprite.graphics.strokeColor(stagexl.Color.White);
    }
  }
}