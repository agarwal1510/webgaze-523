//Conor Kelton, Aman Agarwal
//scroll2.js

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
const util = require('util');
const fs = require('fs');
const proc = require('process');
const path = require('path');
const jsdom = require('jsdom');

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
var data_count = 0;
var loaderId = "";
//var requestId = 0;
if (proc.argv[4] == 'true') {
    emulateMobile = true;
} else {
    emulateMobile = false;
}

CDP(function(client) {

    const { Network, Page, Runtime, Emulation, DOMSnapshot, DOM } = client;
    const { JSDOM } = jsdom;

    function newPage() {
        return new Promise(function(resolve, reject) {
            Page.navigate({ url: 'data:,' }).then(function() {
                resolve("");
            });
        });
    }

    function pageNav(next_url) {
        return new Promise(function(resolve, reject) {

            Page.navigate({ url: next_url }).then((params) => {
                while (1);
                resolve("");
            });
        });
    }

    Network.loadingFinished(params => {
        var content = "(function(){window.addEventListener('load', function(){var elmnt = document.getElementsByClassName('l-container');elmnt[4].scrollIntoView();});})();";
        Page.addScriptToEvaluateOnNewDocument({ source: content });
    });

    function mainFlow() {
        return new Promise(function(resolve, reject) {

            //The core of what this script will do
            function mainIter() {
                return new Promise(function(resolve, reject) {
                    //console.log(url_array[data_count]);
                    newPage().then(function(pageSuccessMsg) {
                        console.log(pageSuccessMsg);
                        return new Promise(function(resolve, reject) {
                            setTimeout(function() {
                                resolve();
                            }, nextPageWait);
                        });
                    }).then(function() {
                        return pageNav("https://www.cnn.com");
                    }).then(function(pageNavMessage) {
                        console.log(pageNavMessage);
                        return new Promise(function(resolve, reject) {
                            setTimeout(function() {
                                resolve();
                            }, pageLoadWait);
                        });
                    }).then(function() {
                        data_count++;
                        setTimeout(function() {
                            resolve();
                        }, nextPageWait);
                    });
                });
            }

            data_fct_array = [];
            data_fct_array.push(mainIter);

            //Chain the functions with promises to enforce synchronous activity
            var data_chain = Promise.resolve(); //Root of the chain
            for (var j = 0; j <= data_fct_array.length; j++) {
                if (j < data_fct_array.length) {
                    data_chain = data_chain.then(data_fct_array[j]);
                } else if (j == data_fct_array.length) {
                    data_chain = data_chain.then(function() {
                        console.log("Wrapping up!");
                        resolve();
                    });
                }
            }
        });
    }

    if (emulateMobile) {
        Promise.all([Network.enable(), Page.enable(), Runtime.enable()])
            .then(function() {
                return new Promise(function(resolve, reject) {
                    Emulation.setDeviceMetricsOverride({ width: screenWidth, height: screenHeight, deviceScaleFactor: 445, mobile: true, fitWindow: true }).then(function() {
                        resolve();
                    });
                });
            }).then(function() {
                return new Promise(function(resolve, reject) {
                    Network.setUserAgentOverride({ userAgent: "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.85 Mobile Safari/537.36" })
                        .then(function() {
                            resolve();
                        });
                });
            }).then(function() {
                return new Promise(function(resolve, reject) {
                    console.log("Emulating cellular4g conditions!");
                    Network.emulateNetworkConditions({ offline: false, latency: 20, downloadThroughput: 500000, uploadThroughput: 375000, connectionType: 'cellular4g' })
                        .then(function() {
                            resolve();
                        });
                });
            }).then(function() {
                return mainFlow();
            }).then(function() {
                client.close();
            }, function(e) {
                console.log(e);
                client.close();
                proc.exit(1);
            });
    } else {
        Promise.all([Network.enable(), Page.enable(), Runtime.enable()])
            .then(function() {
                return mainFlow();
            }).then(function() {
                client.close();
                proc.exit(0);
            }, function(e) {
                console.log(e);
                client.close();
                proc.exit(1);
            });
    }
}).on('error', function(err) {
    console.error('Cannot connect to remote endpoint:', err);
    proc.exit(1);
});