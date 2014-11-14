var gameMenu;
var mapMenu;
var statusElement;
var statsElement;
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
    var options = $(select.selector + " option");

    options.sort(function(a,b) {
        if (a.text > b.text) return 1;
        else if (a.text < b.text) return -1;
        else return 0
    });

    select.empty().append( options );
    select.val(options[0].value);
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
    onChangeGame(gameSelect.val());
}

function newMap(label) {
    newOption(mapSelect, label);
}

function newSection(label) {
    var section = $("<div class='section'>");
    var title = $("<div class='section-title'>");
    var sectionItems = $("<div class='section-items'>");

    title.text(label);
    title.click(function () {
	      if (sectionItems.is(":hidden")) {
	          sectionItems.slideDown("fast");
	      } else {
	          sectionItems.slideUp("fast");
	      }
    })
    section.append(title);
    section.append(sectionItems);
    statsElement.append(section);

    return sectionItems;
}

function newItem(section, itemName, itemTime) {
    var item = $("<div class='item'>");
    var name = $("<span class='item-name'>");
    name.text(itemName);
    var time = $("<span class='item-time'>");
    time.text(itemTime);
    item.append(name);
    item.append(time);
    section.append(item);
}

function updateItems() {
    statsElement.empty();

    var game = gameSelect.val();
    var map = mapSelect.val();

    var sections = data[game].sections;
    for (var sIndex = 0; sIndex < sections.length; ++sIndex) {
        var section = sections[sIndex];
        var sectionElement = newSection(section);
        var items = data[game][map][section];
        var count = 0;
        for (item in items) {
            count++;
            newItem(sectionElement, item, items[item]);
        }
        if (count == 0) {
            sectionElement.remove()
        }
    }
}

function onChangeGame(game) {
    mapSelect.empty();
    gameData = data[game];
    for (map in gameData) {
        newMap(map);
    }
    onChangeMap();
}

function onChangeMap(map) {
    updateItems();
}

function initNav() {
    gameMenu = $("#game");
    // gameMenu.change(function() { onChangeGame($(this).val()); });

    mapMenu = $("#map");
    // mapSelect.change(function() { onChangeMap($(this).val()); });

    statusElement = $("#load-status")
    statsElement = $("#stats")
}

function beginLoading(game) {
    console.log('begin loading', game);
    var element = $("<div>");
    var id = game.replace(" ", "-");
    var label = $("<h1 class='label label-warning' id=" + id + ">")
    label.text(game);
    element.append(label);
    statusElement.append(element);
}

function finishLoading(game) {
    console.log("finish", game);
    var id = game.replace(" ", "-");
    var label = $("#" + id);
    label.toggleClass("label-warning label-success");
}

function loadData(onLoadWorksheet) {
    var scope = 'https://spreadsheets.google.com/feeds';
    var key = "1-oPs_owy6LIv3ROirjysRz4Vvap7h7VLdHsglR9m0po";
    var format = '/public/full?alt=json-in-script';

    function loadWorksheet(id, onLoad) {
        var url = scope + '/list/' + key + '/' + id + format;
        var xhr = createCORSRequest('GET', url);
        xhr.open('GET', url);
        if (!xhr) {
    	      throw new Error('CORS not supported');
        }
        xhr.onerror = function() {
    	      console.log('There was an error!');
        };

        xhr.onload = onLoad(xhr);

        xhr.send();
    }

    var games = [];
    function onLoadInfo(xhr) {
        return function () {
    	      var responseText = xhr.responseText;
	          var startGarbage = "data.io.handleScriptLoaded(";
            var jsonString = responseText.slice(startGarbage.length + 1, -2);
	          var jsonData = JSON.parse(jsonString).feed;
            var entries = jsonData.entry;
            for (var entryIndex = 0; entryIndex < entries.length; ++entryIndex) {
                var entry = entries[entryIndex];
                var game = entry.title.$t;
                games.push(game);
            }

            for (var gameIndex = 0; gameIndex < games.length; ++gameIndex) {
                 var gameName = games[gameIndex]
                beginLoading(gameName);
                var id = gameIndex + 2;
                loadWorksheet(id, onLoadWorksheet);
            }
            console.log("games:", games);
        }
    }
    loadWorksheet(1, onLoadInfo);
}

function parseJsonData(jsonData) {
    var game = jsonData.title.$t;
    finishLoading(game);
    data[game] = {};
    return;
    columnNames = {};
    sectionMap = {};
    sections = [];
    for (var entryIndex = 0; entryIndex < jsonData.entry.length; ++entryIndex) {
        var entry = jsonData.entry[entryIndex];
        var map = entry.title.$t;
        var content = entry.content.$t;
        var items = content.split(", ");

        if (map == "column") {
            for (var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
                var item = items[itemIndex];
                var itemContent = item.split(": ");
                var columnKey = itemContent[0];
                var columnName = itemContent[1];
                columnNames[columnKey] = columnName;
            }
            continue;
        } else if (map == "section") {
            for (var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
                var item = items[itemIndex];
                var itemContent = item.split(": ");
                var columnName = columnNames[itemContent[0]];
                var sectionName = itemContent[1];
                sectionMap[columnName] = sectionName;
            }
            continue;
        } else if (map == "sections") {
            for (var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
                var item = items[itemIndex];
                var itemContent = item.split(": ");
                var sectionName = itemContent[1];
                sections.push(sectionName);
            }
            data[game].sections = sections;
            continue;
        }

        data[game][map] = {};
        for (var i = 0; i < sections.length; ++i) {
            data[game][map][sections[i]] = {}
        }
        for (var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
            var item = items[itemIndex];
            var itemContent = item.split(": ");
            var name = columnNames[itemContent[0]];
            if (name == undefined) {
                console.log("Error: No translation for '" + itemContent[0] + "'");
                name = itemContent[0];
            }
            var time = itemContent[1];
            data[game][map][sectionMap[name]][name] = time;
        }
    }

    newGame(game);
    console.log('done loading', game, data);
}

function initData() {
    data = {};
    loadData(function(xhr) {
        return function () {
    	      var responseText = xhr.responseText;
	          var startGarbage = "data.io.handleScriptLoaded(";
            var jsonString = responseText.slice(startGarbage.length + 1, -2);
	          var jsonData = JSON.parse(jsonString).feed;
            parseJsonData(jsonData);
        }
    });
}

function onReady() {
    initNav();
    initData();
}

$(document).ready(onReady);
