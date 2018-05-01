//Conor Kelton, Aman Agarwal
//scroll.js

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

//List of sites to load - should contain full site name
var siteFile = 'C:\\Users\\ASUS\\Downloads\\webgaze-523\\list2.txt';

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

    function pageNav(next_url, hrefAdded) {
        return new Promise(function(resolve, reject) {

            //var content = "alert('Hello! I am an alert box!');"
            //Page.addScriptToEvaluateOnNewDocument({source : content}); 

            Page.navigate({ url: next_url }).then((params) => {

                if (!hrefAdded) {
                    JSDOM.fromURL(next_url).then(dom => {
                    //Page.getResourceContent({ frameId: params.frameId, url: next_url }).then(params => {
                        //console.log(params.content);
                        
                        //const dom = new JSDOM(params.content);
                        var scripts = dom.window.document.getElementsByTagName("script")
                        //var atag = dom.window.document.querySelectorAll("a");
                        for (each in scripts) {
                            //console.log(atag[each].href);
                            //console.log(each);
                            //console.log(scripts[each].text);
                            if (scripts[each].text != null) {
                                var index = scripts[each].text.indexOf("{\"articleList\"");
                                if (index > 0) {
                                    var str = scripts[each].text.substring(index);
                                    var lIndex = str.indexOf("]", index);
                                    str = str.substring(0, lIndex + 1);
                                    str = str + "}";
                                    //console.log(str);
                                    obj = JSON.parse(str);
                                    var set = new Set();
                                    //console.log(obj.articleList);
                                    for (itr in obj.articleList) {
                                        //console.log(obj.articleList[itr].uri);
                                        var fullURL = "https://www.cnn.com" + obj.articleList[itr].uri;
                                        set.add(fullURL);
                                    }
                                    url_array.push(...set);
                                }
                            }
                        }
                    });
                }

                // if (hrefAdded) {
                //     // var content = "var elmnt = document.getElementsByClassName(\"StoryBodyCompanionColumn css-1bytduc emamhsk0\");elmnt[0].scrollIntoView();";
                //     //var content = "var elmnt = document.getElementsByClassName('l-container');elmnt[4].scrollIntoView();";
                //     var content = "(function(){window.addEventListener('load', function(){var elmnt = document.getElementsByClassName('l-container');elmnt[4].scrollIntoView();});})();";
                //     Page.addScriptToEvaluateOnNewDocument({ source: content });
                // }
                resolve("");
            });
        });
    }

    function mainFlow(hrefAdded) {
        return new Promise(function(resolve, reject) {

            if (!hrefAdded) {
                url_array = [];
                screens_array = [];
                data_fct_array = [];
                // data_count = 0;
                var sites = null;
                var site_array = null;

                sites = fs.readFileSync(siteFile, 'utf-8');
                site_array = sites.split("\n");
                url_array = sites.split("\n");

            } else {
                console.log(url_array.length)
            }

            //The core of what this script will do
            function mainIter() {
                return new Promise(function(resolve, reject) {
                    console.log(url_array[data_count]);
                    newPage().then(function(pageSuccessMsg) {
                        console.log(pageSuccessMsg);
                        return new Promise(function(resolve, reject) {
                            setTimeout(function() {
                                resolve();
                            }, nextPageWait);
                        });
                    }).then(function() {
                        return pageNav(url_array[data_count], hrefAdded);
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

            var startPoint = 0;
            if (hrefAdded) startPoint = data_count;

            //Attach an instance for every url to get metrics
            for (var i = startPoint; i < url_array.length; i++) {
                data_fct_array.push(mainIter);
            }

            //Chain the functions with promises to enforce synchronous activity
            var data_chain = Promise.resolve(); //Root of the chain
            for (var j = startPoint; j <= data_fct_array.length; j++) {
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
                return mainFlow(false);
            }).then(function() {
                return mainFlow(true);
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