//Conor Kelton
//vanillaRecord.js

//Usage:
//node vanillaRecord.js 1920 1080 false 30000
//Arguments: 1 - browser width
//           2 - browser height
//           3 - whether to emulate mobile user agent
//           4 - time to wait before loading next page

//Communitcates to chrome via the CRI.
//Assumes chrome is open with debug port set to 9222, and whatever other flags are relevant.
//Supports communication to an andriod device assuming port 9222 is forwarded via adb.

//All this does is navigate to the sites in the list, to be used with external Record-Replay software like WPR Go

//const chromeLauncher = require('chrome-launcher');
const CDP = require('chrome-remote-interface');
const util  = require('util');
const fs = require('fs');
const proc = require('process');
const path = require('path');
const cmd = require('node-cmd');
const csv = require('fast-csv');


Promise = require('bluebird');
//List of sites to load
var siteFile = 'C:\\Users\\agarw\\Documents\\webgaze-523\\list.txt';

var csvStream = csv.createWriteStream({headers:true});

//Arguments
var pageLoadWait = proc.argv[5];
var nextPageWait = 3000;
var google_chrome;
var screenWidth = parseInt(proc.argv[2]);
var screenHeight = parseInt(proc.argv[3]);
var screenWidthStr = proc.argv[2];
var screenHeightStr = proc.argv[3];
var screenXStr = 0;
var screenYStr = 0;
var emulateMobile = false;
if(proc.argv[4] == 'true'){
  emulateMobile = true;
}

var js_count = 0;
var total_count = 0;
var img_count = 0;

const getAsync = Promise.promisify(cmd.get, { multiArgs: true, context: cmd })


const createCsvWriter = require('csv-writer').createArrayCsvWriter;
const csvWriter = createCsvWriter({
  header: ['sitename', 'first-meaningful-paint','first-interactive'],
  path: 'lighthouse.csv',
  append: true
});


function pageNav(next_url, name, count, len){

  getAsync('lighthouse ' + next_url + ' --chrome-flags="--window-size=360,640 --incognito --ignore-certificate-errors --host-resolver-rules=\\"MAP *:80 127.0.0.1:8080,MAP *:443 127.0.0.1:8081,EXCLUDE localhost\\"" --output-path=./reports/'+name+'.json --output json').then(data => {
    var file = require('./reports/'+name)
    console.log(file.audits['first-meaningful-paint'].rawValue);
    console.log(file.audits['first-interactive'].rawValue);

    const records = [[name, file.audits['first-meaningful-paint'].rawValue, file.audits['first-interactive'].rawValue]];
    csvWriter.writeRecords(records).then(() => {
      console.log('written');
    });

  }).catch(err => {
    console.log('cmd err', err)
  })


  // return new Promise(function(resolve, reject){
  //   cmd.get('lighthouse ' + next_url + ' --chrome-flags="--window-size=360,640 --incognito --ignore-certificate-errors --host-resolver-rules=\\"MAP *:80 127.0.0.1:8080,MAP *:443 127.0.0.1:8081,EXCLUDE localhost\\"" --output-path=./report.json --output json',
  //     function(err, data, stderr){
  //             //console.log('Data: ',data);
  //             console.log('Err: ', err);
  //             //console.log('stderr: ', stderr);

  //             var file = require('./report')
  //             console.log(file.audits['first-meaningful-paint'].rawValue);
  //             console.log(file.audits['first-interactive'].rawValue);
  //       //fs.unlinkSync('./report.json');
  //     }
  //     );

  //   }).then(function(){
  //       resolve("");
  //   });
}

function mainFlow(){
  return new Promise(function(resolve, reject){
    url_array = [];
    name_array = [];
    screens_array = [];
    data_fct_array = [];
    data_count = 0;
    var sites = null;
    var site_array = null;

    sites = fs.readFileSync(siteFile, 'utf-8');
    site_array = sites.split("\n");

      //For each site find the number of viewports
      //Add that site #viewports times to the queue of site loads
      site_array.forEach(function(site){
        var fullSiteURL = "https://www." + site;
        url_array.push(fullSiteURL);
        name_array.push(site.split(".")[0]);
      });

      //The core of what this script will do
      function mainIter(){
        return new Promise(function(resolve, reject){
          console.log(url_array[data_count], name_array[data_count]);

          return new Promise(function(resolve, reject){
            setTimeout(function(){
              resolve();
            }, nextPageWait);
          }).then(function(){
            return pageNav(url_array[data_count], name_array[data_count], data_count, url_array.length);
          }).then(function(){

            console.log("pageNavMessage");
            return new Promise(function(resolve, reject){
              setTimeout(function(){
                resolve();
              }, pageLoadWait);
            });
          }).then(function(){
              //console.log("JS calls- " + js_count + "Image calls- " + img_count + " Total calls- " + total_count);
              //js_count = 0; total_count = 0; img_count = 0;
              console.log(data_count);
              data_count++;
              setTimeout(function(){
                resolve();
              }, nextPageWait);
            });
        });
      }

      //Attach an instance for every url to get metrics
      for(var i = 0; i < url_array.length; i++){
        data_fct_array.push(mainIter);
      }

      //Chain the functions with promises to enforce synchronous activity
      var data_chain = Promise.resolve(); //Root of the chain
      for(var j = 0; j <= data_fct_array.length; j++){
        if(j < data_fct_array.length){
          data_chain = data_chain.then(data_fct_array[j]);
        }
        else if(j == data_fct_array.length){
          data_chain = data_chain.then(function(){
            console.log("Wrapping up!");
            resolve();
          });
        }
      }
    });
}


Promise.all([])
.then(function(){
  return mainFlow();
}).then(function(){
  client.close();
  proc.exit(0);
}, function(e){
  console.log(e);
  client.close();
  proc.exit(1);
});

