'use strict';

var fs = require('fs');
var GithubFetcher = require("./GithubFetcher.js");


var gf = new GithubFetcher( /*"aceFlag.yml"*/ "README.md" );
//gf.collectUsersFromOrg( "aces" );


gf.collectUsersFromList([
  "jonathanlurie"
]);


gf.onFetched( function(json){
  //console.log(json);

  fs.writeFile("output.json", json, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("The file was saved!");
  });

})
