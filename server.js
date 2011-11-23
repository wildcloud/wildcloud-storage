// Copyright (C) 2011 Marek Jelen
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var mongo = require('mongodb');
var http = require('http');
var url = require('url');
var fs = require('fs');
var Path = require('path');
var winston = require('winston');

winston.cli();
winston.info('Bootstraping');

var start = function(db, Config){
  var ruid = 0;
  var get_ruid = function(){
    ruid++;
    if(ruid == 5000) ruid = 1;
    return ruid;
  };
  app = http.createServer(function(request, response){
    var ruid = get_ruid();
    winston.info('(' + ruid + ') New connection');
    // Parse URI
    uri = url.parse(request.url, true);
    // ID of application
    var appid = request.headers['x-appid'];
    winston.info('(' + ruid + ') Requests Appid = ' + appid);
    // Path to save to
    var path = appid + ":" + uri.pathname;
    if(request.method == "GET"){
      if(uri.pathname == "/_list_files"){
        winston.info('(' + ruid + ') Listing files');
        db.collection('fs.files', function(error, collection){
          collection.find({ filename: new RegExp('^' + appid + ":") }, function(error, cursor){
            cursor.each(function(error, file){
              if(file == null){
                response.end();
                winston.info('(' + ruid + ') Listing done');
              }else{
                winston.info('(' + ruid + ') File ' + file.filename); 
                response.write(file.filename + "\n");
              };
            });
          });
        });
      }else{
        var gs = new mongo.GridStore(db, path, "r");
        gs.open(function(error, file){
          winston.info('(' + ruid + ') Downloading file ' + uri.pathname);
          response.writeHead(200, {
            'Content-length': file.length
          });
          stream = file.stream(true);
          stream.on('data', function(data){
            response.write(data);
          });
          stream.on('end', function(){
            winston.info('(' + ruid + ') File downloaded');
            response.end();
          });
        });
      };
    }else if(request.method == "PUT"){
      winston.info('(' + ruid + ') Uploading file ' + uri.pathname);
      var gs = new mongo.GridStore(db, path, "w");
      var pool = [];
      var done = false;
      request.on('data', function(data){
        pool.push(data);
      });
      request.on('end', function(){
        done = true;
      });
      gs.open(function(error, file){
        for(x in pool){
          if(pool[x]){
            file.write(pool[x], function() {});
          };
        };
        pool = [];
        if(done){
          file.close(function(){
            winston.info('(' + ruid + ') File uploaded');
            response.end('OK');
          });
        }else{
          request.on('data', function(data){
            file.write(data, function(){});
          });
          request.on('end', function(){
            file.close(function(){
              winston.info('(' + ruid + ') File uploaded');
              response.end('OK');
            });
          });
        };
      });
    // Delete file
    }else if(request.method == "DELETE"){
      winston.info('(' + ruid + ') Deleting file ' + uri.pathname);
      mongo.GridStore.unlink(db, path, function(){
        winston.info('(' + ruid + ') File deleted');
        response.end('OK');
      });
    }else{
      winston.info('(' + ruid + ') Invalid request.');
      response.end("Unhandled!");
    }
  });

  winston.info('Starting HTTP server on port ' + Config.port);
  app.listen(Config.port, function() {
    winston.info('Listening on port ' + Config.port);
  });

};

var config_file = "/etc/wildcloud/storage.json";
if(!Path.existsSync(config_file)){
  config_file = "storage.json";
};

winston.info("Loading configuration file " + config_file);

fs.readFile(config_file, function(err, data) {
  Config = JSON.parse(data);
  winston.info("Connecting to database");
  mongo.connect(Config.mongodb.url, function(error, db){
    winston.info('Database connected');
    start(db, Config);
  });
});
