part of ar_shared;

class EntityType {
  final _value;
  const EntityType._internal(this._value);
  toString() => "EntityType.$_value";
  
  static const ASTEROID = const EntityType._internal("ASTEROID");
  static const SHIP = const EntityType._internal("SHIP");
}

class Entity
{
  EntityType type;
  Vector2 position;
  double rotationSpeed = 0.0;
  double orientation = 0.0;
  Vector2 acceleration = new Vector2.zero();
  Vector2 velocity = new Vector2.zero();
    
  Entity(this.type, this.position);
}