var FS = require('fs');
var Path = require('path');

Driver = function() {
  var self = this;

  // Setup
  self.setup = function(callback){
    callback();
  };

  // Handles file listing
  self.handleListFiles = function(response, ruid, appid){
    self.log.debug('(' + ruid + ') Listing files for ' + appid);
    FS.readdir('data/' + appid, function(error, files){
      if(error){
        response.writeHead(404, {} );
        response.end();
        return;
      };
      for(file in files){
        response.write(files[file] + "\n");
      };
      response.end();
    });
  };

  // Handles file downloads
  self.handleDownload = function(response, ruid, appid, path, request){
    self.log.debug('(' + ruid + ') Downloading file ' + path + ' for ' + appid);
    var filepath = self.configuration.fs.dir + '/' + appid + '/' + path;
    FS.stat(filepath, function(error, stat){
      if(error){
        response.writeHead(404, {} );
        response.end();
        return;
      };
      stream = FS.createReadStream(filepath);
      response.writeHead(200, {
        'Content-length': stat.size
      });
      stream.pipe(response);
      response.on('close', function(){
        self.log.debug('(' + ruid + ') File downloaded');
      });
    });
  };


  // Handles file uploads
  self.handleUpload = function(response, ruid, appid, path, request){
    self.log.debug('(' + ruid + ') Uploading file ' + path + ' for ' + appid);
    var dir = self.configuration.fs.dir + '/' + appid;
    var filepath =  dir + '/' + path;
    var buffer = [];
    var onData = function(chunk){
      buffer.push(chunk);
    };
    request.addListener('data', onData);
    request.pause();
    FS.mkdir(dir, function(error){
      if(error){
        response.writeHead(500, {});
        response.end();
      };
      stream = FS.createWriteStream(filepath);
      request.removeListener('data', onData);
      for(chunk in buffer){
        stream.write(buffer[chunk]);
      };
      request.resume();
      request.pipe(stream, { end: false });
      stream.on('error', function(error){
        response.end(error.toString());
      });
      request.on('end', function(){
        stream.destroySoon();
        self.log.debug('(' + ruid + ') File uploaded');
        response.end('OK');
      });
    });
  };

  // Handles file deletions
  self.handleDelete = function(response, ruid, appid, path){
    self.log.debug('(' + ruid + ') Deleting file ' + path + ' for ' + appid);
    var filepath = self.configuration.fs.dir + '/' + appid + '/' + path;
    FS.stat(filepath, function(error, stat){
      if(error){
        response.writeHead(404, {} );
        response.end();
        return;
      };
      FS.unlink(filepath, function(){
        self.log.debug('(' + ruid + ') File deleted');
        response.end('OK');
      });
    });
  };

};

exports.driver = Driver;
