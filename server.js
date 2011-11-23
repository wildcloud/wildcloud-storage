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

var Mongo = require('mongodb');
var Http = require('http');
var Url = require('url');
var FS = require('fs');
var Path = require('path');
var winston = require('winston');

Storage = function() {
  // Make the scope accessible
  self = this;

  // Some basics
  this.config_file = '/etc/wildcloud/storage.json';
  this.log = winston;
  this.ruid = 0;

  // Starts the server
  this.start = function(){
    self.log.cli();
    self.log.info('Bootstraping');
    self.loadConfiguration();
    self.connectDatabase(this.startHttpServer);
  };

  // Loads configuration from file
  this.loadConfiguration = function(){
    if(!Path.existsSync(self.config_file)){
      self.config_file = "./storage.json";
    };
    self.log.info("Loading configuration file " + self.config_file);
    self.configuration = JSON.parse(FS.readFileSync(self.config_file));
  };

  // Handles fatal errors
  this.handleError = function(message){
    self.log.error(message);
    process.exit(1);
  };

  // Connect to database
  this.connectDatabase = function(callback){
    self.log.info("Connecting to database");
    Mongo.connect(self.configuration.mongodb.url, function(error, db){
      if(error){
        self.handleError('Can not connect to database');
      }else{
        self.database = db;
        self.log.info('Database connected');
        if(callback) callback();
      }
    });
  };

  // Start HTTP server
  this.startHttpServer = function(){
    self.log.info('Starting HTTP server on port ' + self.configuration.port);
    self.application().listen(self.configuration.port, function() {
      winston.info('Listening on port ' + self.configuration.port);
    });
  };

  // Bootstrap HTTP application
  this.application = function(){
    return Http.createServer(this.handleHttpRequest);
  };

  // Handles incomming HTTP requests
  this.handleHttpRequest = function(request, response){
    // Identify request
    var ruid = self.getRuid(request);
    winston.debug('(' + ruid + ') New connection');
    // Parse URI
    var uri = Url.parse(request.url, true);
    // ID of application
    var appid = request.headers['x-appid'];
    winston.debug('(' + ruid + ') Requests Appid = ' + appid);
    // Path to work with
    var path = appid + ":" + uri.pathname;
    if(request.method == "GET"){
      // GET requests
      if(uri.pathname == "/_list_files"){
        // Listing of files
        self.handleListFiles(response, ruid, appid);
      }else{
        // File downloads
        self.handleDownload(response, ruid, path);
      };
      return;
    };
    if(request.method == "PUT"){
      // File uploads
      self.handleUpload(response, ruid, path, request);
      return;
    };
    if(request.method == "DELETE"){
      // File deletions
      self.handleDelete(response, ruid, path);
      return;
    };
    // Unhandled requests
    winston.info('(' + ruid + ') Invalid request.');
    response.end("Unhandled!");
  };

  // Handles file listing
  this.handleListFiles = function(response, ruid, appid){
    self.log.debug('(' + ruid + ') Listing files');
    self.database.collection('fs.files', function(error, collection){
      if(error){
        self.handleError('(' + ruid + ') Can not access fs.files collection: ' + error);
        return;
      }
      collection.find({ filename: new RegExp('^' + appid + ":") }, function(error, cursor){
        if(error){
          response.end();
          self.log.debug('(' + ruid + ') Listing done with error: ' + error);
          return;
        }
        cursor.each(function(error, file){
          if(error || file == null){
            response.end();
            self.log.debug('(' + ruid + ') Listing done');
          }else{
            response.write(file.filename + "\n");
          };
        });
      });
    });
  };

  // Handles file downloads
  this.handleDownload = function(response, ruid, path){
    var gs = new Mongo.GridStore(self.database, path, "r");
    gs.open(function(error, file){
      if(error){
        response.end();
        self.log.debug('(' + ruid + ') File not downloaded: ' + error);
        return;
      }
      self.log.debug('(' + ruid + ') Downloading file ' + path);
      response.writeHead(200, {
        'Content-length': file.length
      });
      stream = file.stream(true);
      stream.on('data', function(data){
        response.write(data);
      });
      stream.on('end', function(){
        response.end();
        self.log.debug('(' + ruid + ') File downloaded');
      });
    });
  };

  // Handles file uploads
  this.handleUpload = function(response, ruid, path, request){
    self.log.debug('(' + ruid + ') Uploading file ' + path);
    var gs = new Mongo.GridStore(self.database, path, "w");
    var done = false;
    var pool = [];
    // Buffer request until file is opened
    request.on('data', function(data){
      pool.push(data);
    });
    request.on('end', function(){
      done = true;
    });
    gs.open(function(error, file){
      if(error){
        response.end();
        self.log.debug('(' + ruid + ') Could not open file: ' + error);
        done = true;
        pool = [];
        return;
      }
      // Push buffered data to file
      for(index in pool){
        if(pool[index]){
          file.write(pool[index], function() {});
        };
      };
      // Empty the pool
      pool = [];
      var fileClose = function(){
        self.log.debug('(' + ruid + ') File uploaded.');
        response.end('OK');
      };
      if(done){
        // All data were buffered, close file
        file.close(fileClose);
      }else{
        // Continue the upload
        request.on('data', function(data){
          file.write(data, function(){});
        });
        request.on('end', function(){
          file.close(fileClose);
        });
      };
    });
  };

  // Handles file deletions
  this.handleDelete = function(response, ruid, path){
    self.log.debug('(' + ruid + ') Deleting file ' + path);
    Mongo.GridStore.unlink(self.database, path, function(){
      self.log.debug('(' + ruid + ') File deleted');
      response.end('OK');
    });
  };

  // Generated unique ID per request
  this.getRuid = function(request){
    self.ruid++;
    if(self.ruid == 5000) self.ruid = 1;
    return self.ruid;
  };

  return this;
};

storage = new Storage();
storage.start();
