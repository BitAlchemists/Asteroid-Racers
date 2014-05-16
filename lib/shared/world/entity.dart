part of ar_shared;

class Entity
{
  Vector2 position;
    double rotationSpeed = 0.0;
    double orientation = 0.0;
    Vector2 acceleration = new Vector2.zero();
    Vector2 velocity = new Vector2.zero();
    
    Entity(this.position);
}