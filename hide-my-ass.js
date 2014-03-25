var $ = require("node-jquery");
var Q = require("q");
var http = require("http");
var async = require("async");
var _ = require("lodash");
var ping = require("net-ping");

var argv = require('minimist')(process.argv.slice(2));

console.log("Getting page");

var availableIP = [];

getIpList()
    .then(function(ip) {
        return checkIP(ip);
    }).then(function(ip) {
        var sorted = _.sortBy(ip, function(data) {
            return -data.speed;
        });

        console.log(sorted);
    });

function getIpList() {
    var deferred = Q.defer();
    var request = http.get({
        host: argv["host"],
        port: argv["port"],
        path: 'http://tophacksavailable.blogspot.com/'
    }, function(res) {
        var body = "";
        res.on('data', function(chunk) {
            body += chunk;
        }).on('end', function() {
            var ip = body.match(/\d+\.\d+.\d+.\d+:\d+/g);
            deferred.resolve(ip);
        });
    });

    return deferred.promise;
}

function checkIP(ipList) {
    console.log("Check IP list", ipList.length);

    var deferred = Q.defer();
    var queue = async.queue(function(ip, callback) {
        var t = ip.split(":");

        var deferred = Q.defer();
        var request = http.get({
            host: t[0],
            port: t[1],
            path: 'http://cdn-registry-1.docker.io'
        }, function(response) {
            console.log(ip, response.statusCode);
            if (response.statusCode == 200) {
                deferred.resolve(ip);
            } else {
                deferred.reject(ip);
            }
        }).on('error', function(e) {
            console.log(ip, e.message, "Error");
            deferred.reject(ip);
        });

        request.setTimeout(5000, function() {
            console.log(ip, "Timeout");
            request.abort();
            deferred.reject(ip);
        });

        deferred.promise.then(function(proxy) {
            var ip = proxy.split(":")[0];
            pingIp(ip).then(function(data) {
                availableIP.push(data);
            })
            callback();
        }, callback);
    }, 50);

    queue.drain = function() {
        console.log("******* Done *********");
        console.log("Found: ", availableIP.length);
        deferred.resolve(availableIP);
    };

    var count = 0;
    queue.push(ipList);

    return deferred.promise;
}

function pingIp(target) {
    var deferred = Q.defer();

    var session = ping.createSession();

    session.pingHost(target, function(error, target, sent, rcvd) {
        var ms = rcvd - sent;
        if (error) {
            deferred.reject(error);
            console.log(target + ": " + error.toString());
        } else {
            console.log(target + ": Alive (ms=" + ms + ")");
            var data = {
                "proxy": target,
                "speed": ms
            };
            deferred.resolve(data);
        }
    });

    return deferred.promise;
}