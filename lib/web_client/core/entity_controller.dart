part of web_client;

class EntityController {
  final Entity _entity;
  Entity get entity => _entity;
  
  stagexl.Sprite sprite;
  
  EntityController(Entity this._entity, this.sprite){
    updateSprite();
  }
  
  updateSprite(){
    sprite.x = _entity.position.x;
    sprite.y = _entity.position.y;
    
    sprite.rotation = _entity.orientation;
  }
}