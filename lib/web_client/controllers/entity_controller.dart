part of web_client;

class EntityController {
  final Entity _entity;
  Entity get entity => _entity;
    
  stagexl.Sprite _sprite = new stagexl.Sprite();
  stagexl.Sprite get sprite => _sprite;
  
  EntityController(Entity this._entity)
  {
    _createSprite(_entity);
    updateSprite();
  }
  
  factory EntityController.factory(Entity entity){
    switch(entity.type){
      case EntityType.ASTEROID:
        return new EntityController(entity);
      case EntityType.CHECKPOINT:
        return new CheckpointController(entity);
      case EntityType.LAUNCH_PLATFORM:
        return new PlatformController(entity);
      default:
        print("cant create entity controller for unknown entity $entity");
    }
  }
  
  _createSprite(Entity entity) {
    switch(entity.type){
      case EntityType.ASTEROID:
        RenderHelper.applyAsteroid(sprite.graphics, entity.radius);
        break;
      default:
        print("cant _createSprite() for unknown entity.");
    }            
  }
  
  updateSprite(){
    sprite.x = _entity.position.x;
    sprite.y = _entity.position.y;
    
    sprite.rotation = _entity.orientation;
  }
  
  updateFromServer(Entity entity){
    _entity.copyFrom(entity);
    updateSprite();
  }
}