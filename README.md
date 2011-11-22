# Wildcloud - Storage

Responsible for storage in Wildcloud. Right now uses MongoDB GridFS as backend, but the client should not care.

## Interface

Specify special header to autheticate your application

  X-Appid: <application id>

To save a file into the storage

  PUT /some/path

to get file from storage

  GET /some/path

and delete the file

  DELETE /some/path

## LICENSE

Project is licensed under the terms of the GNU Affero General Public License.

*Other licensing options are open for discussion.*
