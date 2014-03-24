var $ = require("node-jquery");
var Q = require("q");
var http = require("http");
var async = require("async");
var _ = require("lodash");

var argv = require('minimist')(process.argv.slice(2));

console.log("Getting page");
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
        checkIP(ip);
    });
});

var availableIP = [];

function checkIP(ipList) {
    console.log("Check IP list", ipList.length);

    var queue = async.queue(function(ip, callback) {
        var t = ip.split(":");
        var request = http.get({
            host: t[0],
            port: t[1],
            path: 'http://cdn-registry-1.docker.io'
        }, function(response) {
            console.log(ip, response.statusCode);
            if (response.statusCode == 200) {
                availableIP.push(ip);
                callback();
            }
        }).on('error', function(e) {
            console.log(ip, e.message, "Error");
            if (e.message == "ECONNRESET") {
                return;
            }
            callback();
        });

        request.setTimeout(10000, function() {
            console.log("Request abort", ip);
            request.abort();
        });
    }, 50);

    queue.drain = function() {
        console.log("Done", availableIP.length);
        console.log(availableIP);
    };

    queue.push(ipList);
}