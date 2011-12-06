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
    self.loadDriver();
  };

  // Loads configuration from file
  this.loadConfiguration = function(){
    if(!Path.existsSync(self.config_file)){
      self.config_file = "./storage.json";
    };
    self.log.info("Loading configuration file " + self.config_file);
    self.configuration = JSON.parse(FS.readFileSync(self.config_file));
  };

  // Load driver for data storage
  this.loadDriver = function(){
    self.log.info("Loading driver '" + self.configuration.driver + "'");
    var driverClass = require('./' + self.configuration.driver + '.js').driver;
    var driver = new driverClass();
    // Pass environment to driver
    driver.configuration = self.configuration;
    driver.log = self.log;
    // Mount handlers
    self.handleListFiles = driver.handleListFiles;
    self.handleDownload = driver.handleDownload;
    self.handleUpload = driver.handleUpload;
    self.handleDelete = driver.handleDelete;
    // Setup driver
    driver.setup(this.startHttpServer);
  };

  // Handles fatal errors
  this.handleError = function(message){
    self.log.error(message);
    process.exit(1);
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
    var path = uri.pathname.substring(1);
    if(request.method == "GET"){
      // GET requests
      if(uri.pathname == "/_list_files"){
        // Listing of files
        self.handleListFiles(response, ruid, appid);
      }else{
        // File downloads
        self.handleDownload(response, ruid, appid, path, request);
      };
      return;
    };
    if(request.method == "PUT"){
      // File uploads
      self.handleUpload(response, ruid, appid, path, request);
      return;
    };
    if(request.method == "DELETE"){
      // File deletions
      self.handleDelete(response, ruid, appid, path);
      return;
    };
    // Unhandled requests
    winston.info('(' + ruid + ') Invalid request.');
    response.end("Unhandled!");
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
