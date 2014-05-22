part of web_client;

class EntityController {
  final Entity _entity;
  Entity get entity => _entity;
  
  stagexl.Sprite _sprite = new stagexl.Sprite();
  stagexl.Sprite get sprite => _sprite;
  
  EntityController(Entity this._entity){
    _createSprite(_entity);
    updateSprite();
  }
  
  stagexl.Sprite _createSprite(Entity entity) {
    switch(entity.type){
      case EntityType.ASTEROID:
        RenderHelper.applyAsteroid(sprite.graphics);
        break;
      case EntityType.SHIP:
        RenderHelper.applyTriangle(sprite.graphics);
        break;
    }
        
    if(entity.displayName != null && entity.displayName != "")
    {
      stagexl.TextField textField = new stagexl.TextField();
      textField.text = entity.displayName;
      textField.textColor = stagexl.Color.White;
      textField.y = 10;
      textField.x = - textField.textWidth / 2.0;
      textField.width = textField.textWidth;
      sprite.addChild(textField);
    }
    
    return sprite;
  }
  
  updateSprite(){
    sprite.x = _entity.position.x;
    sprite.y = _entity.position.y;
    
    sprite.rotation = _entity.orientation;
  }
}