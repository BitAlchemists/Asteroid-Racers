part of asteroidracers;

class Point {
  num x, y;

  Point([this.x, this.y]);
  
  operator +(Point p) => new Point(x + p.x, y + p.y);
}
