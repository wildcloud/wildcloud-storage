# Wildcloud - Storage

Responsible for storage in Wildcloud. Right now uses MongoDB GridFS as backend, but the client should not care.

## Interface

Specify special header to autheticate your application

    X-Appid: <application id>

To save a file into the storage

    PUT /some/path

to get file from storage

    GET /some/path

to list files in storage

    GET /_list_files

and delete the file

    DELETE /some/path

## LICENSE

Project is licensed under the terms of the Apache 2 License.