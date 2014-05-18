part of web_client;

class EntityController {
  final Entity _entity;
  Entity get entity => _entity;
  
  final stagexl.Sprite _sprite = new stagexl.Sprite();
  stagexl.Sprite get sprite => _sprite;
  
  EntityController(Entity this._entity){
    updateSprite();
  }
  
  updateSprite(){
    _sprite.x = _entity.position.x;
    _sprite.y = _entity.position.y;
    
    _sprite.rotation = _entity.orientation;
  }
}