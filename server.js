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

var start = function(db, Config){

  app = http.createServer(function(request, response){
    console.log('New request');
    uri = url.parse(request.url, true);
    // ID of application
    var appid = request.headers['x-appid'];
    console.log('Appid: ' + appid);
    // Path to save to
    var path = appid + ":" + uri.pathname;
    // Get file
    if(request.method == "GET"){
      var gs = new mongo.GridStore(db, path, "r");
      gs.open(function(error, file){
        console.log('Downloading file: ' + error);
        response.writeHead(200, {
          'Content-length': file.length
        });
        stream = file.stream(true);
        stream.on('data', function(data){
          console.log('Reading data.');
          response.write(data);
        });
        stream.on('end', function(){
          console.log('Ready.');
          response.end();
        });
      });
    // Save file
    }else if(request.method == "POST"){
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
        console.log('Uploading file: ' + error);
        for(x in pool){
          if(pool[x]){
            file.write(pool[x], function() {});
          };
        };
        pool = [];
        if(done){
          file.close(function(){
            console.log('Ready.');
            response.end('OK');
          });
        }else{
          request.on('data', function(data){
            console.log('Writing data.' + data);
            file.write(data, function(){});
          });
          request.on('end', function(){
            file.close(function(){
              console.log('Ready.');
              response.end('OK');
            });
          });
        };
      });
    // Delete file
    }else if(request.method == "DELETE"){
      console.log('Deleting file.');
      mongo.GridStore.unlink(db, path, function(){
        console.log('Ready.');
        response.end('OK');
      });
    }else{
      response.end("Unhandled!");
    }
  });

  app.listen(Config.port, function() {
    console.log("Listening on port " + Config.port);
  });

};

fs.readFile('storage.json', function(err, data) {

  Config = JSON.parse(data);

  mongo.connect(Config.mongodb.url, function(error, db){
    start(db, Config);
  });

});
