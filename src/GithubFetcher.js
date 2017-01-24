'use strict';

var request = require('request');
var GitHubApi = require("github");
var yaml = require('js-yaml');
var config = require('../config.json');

class GithubFetcher{
  constructor( flagFile ){
    this._flagFile = flagFile;
    this._githubToken = config.githubAPIkey;

    this._github = new GitHubApi({
      debug: false
    });

    this._authenticate();

    //unique
    this._users = {};

    this._onFetchedCallback = null;

    this._orgInfo = [];

    this._nbRepoToProcess = 0;

  }


  /**
  * [PRIVATE]
  * Perform auth to unlock Github API quota.
  */
  _authenticate(){
    // setup the authentification (unlock quota)
    this._github.authenticate({
      type: "token",
      //type: "oauth",
      token: this._githubToken,
    });
  }


  /**
  * Add users
  */
  collectUsersFromOrg( githubOrgName ){
    var that = this;

    // get info about org
    this._github.orgs.get(
      {
        org: githubOrgName
      },

      // callback
      function(err, res) {

        if( err )
          throw(err);

        that._orgInfo.push( res );
        //console.log(res);

        var numOfMembers = res.plan.filled_seats;
        console.log( "Members in " + githubOrgName + ": " + numOfMembers );

        var memberPerPage = 100;

        for(var i=0; i<Math.ceil(numOfMembers / memberPerPage); i++){

          // really getting members list
          that._github.orgs.getMembers(
            {
            org: githubOrgName,
            page: i,
            per_page: memberPerPage
            },

            function(err, membersInfo) {
              if( err ){
                console.log(err);
                return;
              }

            // for each member of this page
            for(var u=0; u<membersInfo.length; u++){
              if( !(membersInfo[u].login in that._users)){

                that._users[membersInfo[u].login] = {
                  repos: {}
                }

                that._fetchRepoFromUser( membersInfo[u].login );
              }
            }



          });
        }

      }
    );
  }



  collectUsersFromList( listOfUsers ){
    var that = this;

    listOfUsers.forEach(function(username){

      if( !(username in that._users)){

        that._users[username] = {
          repos: {}
        }

        that._fetchRepoFromUser( username );
      }

    });

  }


  /**
  * [PRIVATE]
  * will fetch all the repos from a list of users
  * @param {Array} userList - a list or gh users as retrived by gh API
  */
  _fetchRepoFromUser( username ){
    var that = this;

    // get more user info (necessary for num of repo)
    that._github.users.getForUser(
      {
        username: username
      },
      // callback
      function(err, userInfo) {

        if( err ){
          console.log( err );
          return;
        }

        var username = userInfo.login;
        var numOfRepo = userInfo.public_repos;
        var numRepoPerPage = 2;

        var reposList = that._users[username].repos;


        // for each page
        for(var i=0; i<=Math.ceil(numOfRepo / numRepoPerPage); i++){

          // get every public repo for a user
          that._github.repos.getForUser({
            page: i,
            per_page: numRepoPerPage,
            username: username,
            type: "owner"
          }, function(err, repoInfo) {
            if( err ){
              console.log( err );
              return;
            }

            // for each repo of this user
            for(var r=0; r<repoInfo.length; r++){

              var repoName = repoInfo[r].name

              if( !(repoName in reposList) ){
                reposList[ repoName ] = repoInfo[r];

                that._processRepo(repoInfo[r]);
              }


            }

          });

        }

      }

    );


  }


  /**
  * [PRIVATE]
  */
  _processRepo( ghRepo ){
    var that = this;

    this._nbRepoToProcess ++;

    //console.log( ghRepo.name );
    //console.log( ghRepo );

    var username = ghRepo.owner.login;
    var repoName = ghRepo.name;

    var flagFileURL = "https://raw.githubusercontent.com/" +
      username + "/" +
      repoName + "/master/" +
      this._flagFile;


    // getting the file content
    request.get(
      flagFileURL,

      function (error, response, body) {
        that._nbRepoToProcess --;

        if (!error && response.statusCode == 200) {
            var flagFileContent = body;
            //console.log(flagFileContent);
            //process.exit();
            console.log("[+]" + username + " > " + repoName);

            var ymlFlag = "";

            try{
              //ymlFlag = yaml.safeLoad(flagFileContent);
            }catch(e){

            }

            that._users[username].repos[repoName].flagFileContent = ymlFlag;

        }else{
          //console.log("[-]" + username + " > " + repoName);
          // remove the repo from the list if it does not contain the flag file
          delete that._users[username].repos[repoName];
        }


        if( that._nbRepoToProcess == 0 ){
          console.log("\nFETCH DONE");
          that._doneFetchingData();
        }

      }
    );

  }


  _doneFetchingData(){
    var userOverview = [];

    var listOfUsernames = Object.keys(this._users);

    // for each username
    for(var u=0; u<listOfUsernames.length; u++){

      var user = {
        username: listOfUsernames[u],
        profileUrl: null,
        imageUrl: null,
        repositories: []
      };

      var listOfRepoNames = Object.keys(this._users[ listOfUsernames[u] ].repos);

      for(var r=0; r<listOfRepoNames.length; r++){

        var extendedRepo = this._users[ listOfUsernames[u] ].repos[ listOfRepoNames[r] ];

        var shortRepo = {
          name: extendedRepo.name,
          url: extendedRepo.html_url,
          description: extendedRepo.description,
          language: extendedRepo.language,
          lastUpdate: extendedRepo.updated_at,
          flagFileContent: extendedRepo.flagFileContent
        }

        // 1st repo of the list, we update user info
        if(!r){
          user.imageUrl = extendedRepo.owner.avatar_url;
          user.profileUrl = extendedRepo.owner.html_url;
        }

        user.repositories.push(shortRepo)

        //console.log(extendedRepo);
      }

      // adding the user only if he has some repos
      if( user.repositories.length){
        userOverview.push( user );
      }



    }

    //console.log(JSON.stringify(userOverview));

    if(this._onFetchedCallback){
      this._onFetchedCallback( JSON.stringify(userOverview) );
    }
  }


  onFetched( cb ){
    this._onFetchedCallback = cb;
  }

}

module.exports = GithubFetcher;
