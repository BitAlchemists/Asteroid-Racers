part of ar_client;

class RenderChunk {
  
  List<vec3> vertices;
  String color;
  
  RenderChunk.triangle() {
    vertices = new List<vec3>();
    vertices.add(new vec3(-5.0, -5.0, 0.0));
    vertices.add(new vec3(0.0, 10.0, 0.0));
    vertices.add(new vec3(5.0, -5.0, 0.0));
    color = "green";
  }
  
  RenderChunk.asteroid() {
    vertices = new List<vec3>();
    
    Math.Random random = new Math.Random();
    
    num minRadius = 3;
    num maxRadius = 30;
    num outerRadius = random.nextDouble() * (maxRadius - minRadius) + minRadius;
    num innerRadius = outerRadius * 0.75;
    int numVertices = outerRadius.toInt();
    
    for(int i = 0; i < numVertices; i++) {
      num angle = (i.toDouble() / numVertices.toDouble());
      num radius = random.nextDouble() * (outerRadius - innerRadius) + innerRadius;
      
      vec3 vector = new vec3(Math.cos(angle * Math.PI*2) * radius, Math.sin(angle * Math.PI*2) * radius, 0.0);
      vertices.add(vector);
    }
    color = "yellow";
  }
  
}

/*
 
// Rotation of pi/2 degrees around the Y axis followed by a 
// translation of (5.0, 2.0, 3.0).
mat4 T = new mat4.rotationY(pi*0.5).translate(5.0, 2.0, 3.0);
// A point.
vec3 position = new vec3.raw(1.0, 1.0, 1.0);
// Transform position by T.
T.transform3(position);
*/