var gameSelect;
var mapSelect;
var data;

function createCORSRequest(method, url) {
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr) {

    // Check if the XMLHttpRequest object has a "withCredentials" property.
    // "withCredentials" only exists on XMLHTTPRequest2 objects.
    xhr.open(method, url, true);

  } else if (typeof XDomainRequest != "undefined") {

    // Otherwise, check if XDomainRequest.
    // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
    xhr = new XDomainRequest();
    xhr.open(method, url);

  } else {

    // Otherwise, CORS is not supported by the browser.
    xhr = null;

  }
  return xhr;
}

function sortOptions(select) {
    var options = $("#" + select.attr("id") + " option");

    options.sort(function(a,b) {
        if (a.text > b.text) return 1;
        else if (a.text < b.text) return -1;
        else return 0
    });

    select.empty().append( options );
    gameSelect.val(options[0].value);
}

function newOption(select, label) {
    var item = $("<option>");
    item.text(label);
    item.attr("value", label);
    select.append(item);
    sortOptions(select);
}

function newGame(label) {
    newOption(gameSelect, label);
}

function newMap(label) {
    newOption(mapSelect, label);
}

function initSelects() {
    gameSelect = $("#game");
    gameSelect.change(function() { console.log("change", $(this).val()); });
    mapSelect = $("#map");
}

function loadData(onLoadWorksheet) {
    var scope = 'https://spreadsheets.google.com/feeds';
    var key = "1-oPs_owy6LIv3ROirjysRz4Vvap7h7VLdHsglR9m0po";
    var format = '/public/full?alt=json-in-script';

    function loadWorksheet(id) {
        var url = scope + '/list/' + key + '/' + id + format;
        var xhr = createCORSRequest('GET', url);
        xhr.open('GET', url);
        if (!xhr) {
    	      throw new Error('CORS not supported');
        }
        xhr.onerror = function() {
    	      console.log('There was an error!');
        };

        xhr.onload = onLoadWorksheet(xhr);

        xhr.send();
    }

    var halos = [1, 2];

    for (var i = 0; i < halos.length; ++i) {
        var halo = halos[i]
        var id = halo + 1;
        loadWorksheet(id);
    }
}

function onReady() {
    initSelects();

    loadData(function(xhr) {
        return function () {
    	      var responseText = xhr.responseText;
	          var startGarbage = "data.io.handleScriptLoaded(";
	          var data = JSON.parse(responseText.slice(startGarbage.length + 1, -2)).feed;
	          console.log(data)
	          console.log(data.title.$t);
            newGame(data.title.$t);
        }
    });
}

$(document).ready(onReady);
