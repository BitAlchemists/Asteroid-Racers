part of ar_server;

class StaticFileHandler {
  final String basePath;

  StaticFileHandler(this.basePath);

  _send404(HttpResponse response) {
    response.statusCode = HttpStatus.NOT_FOUND;
    response.write("404 - File Not Found");
    response.close();
  }

  // TODO: etags, last-modified-since support
  onRequest(HttpRequest request) {
    final String localPath =
        request.uri.path == '/' ? 'asteroidracers.html' : request.uri.path.substring(1, request.uri.path.length);
    
    String filePath = path.join(basePath, localPath);
    final File file = new File(filePath);
    if(file.existsSync()){
        file.openRead().pipe(request.response).catchError((e) => print(e));
    }
    else {
      _send404(request.response);
    }
  }
}
