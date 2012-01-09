/*
 Copyright 2011 Marek Jelen

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var Mongo = require('mongodb');

Driver = function () {
    var self = this;

    // Setup driver
    self.setup = function (callback) {
        self.setupCallback = callback;
        self.connectDatabase();
    };

    // Handles fatal errors
    self.handleError = function (message) {
        self.log.error(message);
        process.exit(1);
    };

    // Connect to database
    self.connectDatabase = function () {
        self.log.info("Connecting to database");
        Mongo.connect(self.configuration.mongodb.url, function (error, db) {
            if (error) {
                self.handleError('Database connection problem');
            } else {
                self.database = db;
                self.log.info('Database connected');
                self.setupCallback();
            }
        });
    };

    // Handles file listing
    this.handleListFiles = function (response, ruid, appid) {
        self.log.debug('(' + ruid + ') Listing files');
        self.database.collection('fs.files', function (error, collection) {
            if (error) {
                self.handleError('(' + ruid + ') Can not access fs.files collection: ' + error);
                return;
            }
            collection.find({ filename:new RegExp('^' + appid + ":") }, function (error, cursor) {
                if (error) {
                    response.end();
                    self.log.debug('(' + ruid + ') Listing done with error: ' + error);
                    return;
                }
                cursor.each(function (error, file) {
                    if (error || file == null) {
                        response.end();
                        self.log.debug('(' + ruid + ') Listing done');
                    } else {
                        response.write(file.filename.replace(appid + ':', '') + "\n");
                    }
                });
            });
        });
    };

    // Handles file downloads
    this.handleDownload = function (response, ruid, appid, path, request) {
        var filepath = appid + ":" + path;
        var gs = new Mongo.GridStore(self.database, filepath, "r");
        gs.open(function (error, file) {
            if (error) {
                response.end();
                self.log.debug('(' + ruid + ') File not downloaded: ' + error);
                return;
            }
            self.log.debug('(' + ruid + ') Downloading file ' + path);
            response.writeHead(200, {
                'Content-length':file.length
            });
            stream = file.stream(true);
            stream.pipe(response);
            request.on('close', function () {
                file.close(function () {
                    self.log.debug('(' + ruid + ') Connection closed prematurely');
                });
            });
            response.on('close', function () {
                self.log.debug('(' + ruid + ') File downloaded');
            });
        });
    };

    // Handles file uploads
    this.handleUpload = function (response, ruid, appid, path, request) {
        self.log.debug('(' + ruid + ') Uploading file ' + path);
        var filepath = appid + ":" + path;
        var gs = new Mongo.GridStore(self.database, filepath, "w");
        var done = false;
        var allWritten = false;
        var buffer = [];
        var onChunkWritten = null;
        var writing = false;
        request.on('data', onBufferData = function (data) {
            self.log.debug('(' + ruid + ') Filling buffer.');
            buffer.push(data);
            request.pause();
            if (onChunkWritten && !writing) {
                onChunkWritten();
            }
        });
        request.on('end', onBufferEnd = function () {
            self.log.debug('(' + ruid + ') Request ended.');
            done = true;
        });
        request.pause();
        gs.open(function (error, file) {
            if (error) {
                response.end();
                self.log.debug('(' + ruid + ') Could not open file: ' + error);
                return;
            }
            var onBufferDrain = function () {
                self.log.debug('(' + ruid + ') Resuming');
                request.resume();
            };
            onChunkWritten = function () {
                writing = false;
                if (buffer.length == 0) {
                    if (done) {
                        file.close(function () {
                            self.log.debug('(' + ruid + ') File uploaded.');
                            response.end('OK');
                        });
                    } else {
                        self.log.debug('(' + ruid + ') Drained ');
                        onBufferDrain();
                    }
                } else {
                    self.log.debug('(' + ruid + ') Writing.');
                    writing = true;
                    file.write(buffer.shift(), onChunkWritten);
                }
            };
            request.removeListener('end', onBufferEnd);
            request.on('end', function () {
                self.log.debug('(' + ruid + ') Request ended.');
                done = true;
                if (buffer.length == 0 && !writing) {
                    file.close(function () {
                        self.log.debug('(' + ruid + ') File uploaded.');
                        response.end('OK');
                    });
                }
            });
            onChunkWritten();
        });
    };

    // Handles file deletions
    this.handleDelete = function (response, ruid, appid, path) {
        self.log.debug('(' + ruid + ') Deleting file ' + path);
        var filepath = appid + ":" + path;
        Mongo.GridStore.unlink(self.database, filepath, function () {
            self.log.debug('(' + ruid + ') File deleted');
            response.end('OK');
        });
    };

};

exports.driver = Driver;
