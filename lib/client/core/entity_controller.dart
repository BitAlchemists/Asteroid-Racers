part of ar_client;

class EntityController {
  Entity _entity;
  Entity get entity => _entity;
  
  stagexl.Sprite _sprite;
  stagexl.Sprite get sprite => _sprite;
  
  EntityController(Vector2 position){
    _entity = new Entity(position);
    _sprite = new stagexl.Sprite();
    updateSprite();
  }
  
  updateSprite(){
    _sprite.x = _entity.position.x;
    _sprite.y = _entity.position.y;
    
    _sprite.rotation = _entity.orientation;
  }
}