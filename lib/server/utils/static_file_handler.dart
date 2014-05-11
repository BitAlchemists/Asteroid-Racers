part of ar_server;

class StaticFileHandler {
  final String basePath;

  StaticFileHandler(this.basePath);

  _send404(HttpResponse response) {
    response.statusCode = HttpStatus.NOT_FOUND;
    response.close();
  }

  // TODO: etags, last-modified-since support
  onRequest(HttpRequest request) {
    final String localPath =
        request.uri.path == '/' ? '/index.html' : request.uri.path;
    
    String filePath = path.join(basePath, localPath);
    
    final File file = new File(filePath);
    file.exists().then((bool found) {
      if (found) {
        file.openRead().pipe(request.response).catchError((e) => print(e));
      } else {
        _send404(request.response);
      }
    });
  }
}
