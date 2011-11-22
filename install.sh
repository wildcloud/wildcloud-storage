#!/bin/sh
##############################################################
#
# Author: Ruslan Khissamov, email: rrkhissamov@gmail.com
#
# http://apptob.org/
#
##############################################################


# Add MongoDB Package
echo 'Add MongoDB Package'
echo "deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen" >> /etc/apt/sources.list
apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
echo 'MongoDB Package completed'

# Update System
echo 'System Update'
apt-get -y update
echo 'Update completed'

# Install help app
apt-get -y install libssl-dev git-core pkg-config build-essential curl gcc g++

# Download & Unpack Node.js - v. 0.6.2
echo 'Download Node.js - v. 0.6.2'
mkdir /tmp/node-install
cd /tmp/node-install
wget http://nodejs.org/dist/v0.6.2/node-v0.6.2.tar.gz
tar -zxf node-v0.6.2.tar.gz
echo 'Node.js download & unpack completed'

# Install Node.js
echo 'Install Node.js'
cd node-v0.6.2
./configure && make && make install
echo 'Node.js install completed'

# Install Node Package Manager
echo 'Install Node Package Manager'
curl http://npmjs.org/install.sh | sudo sh
echo 'NPM install completed'

# Install Forever
echo 'Install Forever'
npm install forever -g
echo 'Forever install completed'

# Install MongoDB
echo 'Install MongoDB'
apt-get -y install mongodb-10gen
echo 'MongoDB install completed.'

# Install Wildcloud storage
cd ~
git clone git://github.com/marekjelen/wildcloud-storage.git

# Start Wildcloud storage
# cd ~/wildcloud-storage
# forever start -v -o logs/out.log -e logs/err.log server.js
