part of game_client;

class CheckpointController extends EntityController {
  
  Checkpoint get _checkpoint => entity;
  
  CheckpointController(entity) : super(entity);
  
  updateSprite(){    
    sprite.graphics.clear();
    RenderHelper.applyCircle(sprite, _checkpoint.radius);
    
    super.updateSprite();
    switch(_checkpoint.state)
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