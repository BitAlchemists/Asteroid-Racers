part of ar_client;

class Entity
{
  Vector2 position;
    double orientation = 0.0;
    Vector2 acceleration = new Vector2.zero();
    Vector2 velocity = new Vector2.zero();
    
    Entity(this.position);
}