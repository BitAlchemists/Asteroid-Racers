import "../lib/tcp_server/tcp_server.dart" as ar_server;
import "dart:io";
import "package:path/path.dart" as path;

main() {
    ar_server.runServer([path.join(Directory.current.path, "../web")], null, 1337).then((value){
      Process.start('explorer', ["http://localhost:1337/asteroidracers.html"]).then((Process process) {
        //process.stdout
        //  .transform(UTF8.decoder)
        //  .listen((data) { print(data); });
        //process.stdin.writeln('Hello, world!');
        //process.stdin.writeln('Hello, galaxy!');
        //process.stdin.writeln('Hello, universe!');
      });
    });
}