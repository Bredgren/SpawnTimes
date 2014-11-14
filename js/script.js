// TODO:
//  - show current game/map
//  - game not showing up
//  - items
//  - lazy loading
//  - caching

var gameMenu;
var mapMenu;
var currentGame;
var currentMap;
var statusElement;
var statsElement;
var data;
var loadCount;
var loadMax;

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

function sortItems(menu) {
    var items = $(menu.selector + " option");
    items.sort(function(a,b) {
        if (a.text > b.text) return 1;
        else if (a.text < b.text) return -1;
        else return 0
    });
    menu.empty().append(items);
    menu.val(items[0].value);
}

function onChangeGame(game) {
    currentGame = game;
    mapMenu.empty();
    gameData = data[game];
    var maps = [];
    for (map in gameData) {
        if (map != "sections") {
            maps.push(map);
            newMap(map);
        }
    }
    maps.sort();
    onChangeMap(maps[0]);
}

function newGame(label) {
    newMenuItem(gameMenu, label);
}

function newMap(label) {
    newMenuItem(mapMenu, label);
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

    var sections = data[currentGame].sections;
    for (var sIndex = 0; sIndex < sections.length; ++sIndex) {
        var section = sections[sIndex];
        var sectionElement = newSection(section);
        var items = data[currentGame][currentMap][section];
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

function onChangeMap(map) {
    currentMap = map;
    updateItems();
}

function newMenuItem(menu, label) {
    var item = $("<option>");
    item.text(label);
    menu.append(item);
    sortItems(menu);
}

function initNav() {
    gameMenu = $("#game");
    gameMenu.change(function() { onChangeGame($(this).val()); });
    mapMenu = $("#map");
    mapMenu.change(function() { onChangeMap($(this).val()); });
    statusElement = $("#load-status")
    statsElement = $("#stats")
}

function doneLoading() {
    statusElement.empty();
    console.log(data) // *
    var games = [];
    for (game in data) {
        games.push(game);
        newGame(game);
    }
    games.sort();
    onChangeGame(games[0]);
}

function onLoadResult() {
    loadCount++;
    if (loadCount == loadMax) {
        doneLoading();
    }
}

function beginLoading(game) {
    console.log('begin loading', game);
    var id = game.replace(" ", "-");
    var h = $("<h1>");
    var label = $("<span class='label label-warning' id=" + id + ">")
    label.text(game);
    h.append(label);
    statusElement.append(h);
}

function loadSuccess(game) {
    var id = game.replace(" ", "-");
    var label = $("#" + id);
    label.toggleClass("label-warning label-success");
    onLoadResult();
}

function loadFail(game) {
    var id = game.replace(" ", "-");
    var label = $("#" + id);
    if (label.hasClass("label-warning")) {
	label.toggleClass("label-warning label-danger");
	onLoadResult();
    }
}

function loadData(onLoadWorksheet) {
    var scope = 'https://spreadsheets.google.com/feeds';
    var key = "1-oPs_owy6LIv3ROirjysRz4Vvap7h7VLdHsglR9m0po";
    var format = '/public/full?alt=json-in-script';

    function loadWorksheet(id, onLoad, game) {
        var url = scope + '/list/' + key + '/' + id + format;
        var xhr = createCORSRequest('GET', url);
        xhr.open('GET', url);
        if (!xhr) {
    	      throw new Error('CORS not supported');
        }
        xhr.onerror = function() {
                loadFail(game);
        };

        xhr.onload = onLoad(xhr, game);

        xhr.send();
    }

    var games = [];
    function onLoadInfo(xhr, game) {
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

            loadMax = games.length;

            for (var gameIndex = 0; gameIndex < games.length; ++gameIndex) {
                var gameName = games[gameIndex]
                beginLoading(gameName);
                var id = gameIndex + 2;
                loadWorksheet(id, onLoadWorksheet, gameName);
            }
            console.log("games:", games);
        }
    }
    loadWorksheet(1, onLoadInfo, "Info");
}

function parseJsonData(jsonData) {
    var game = jsonData.title.$t;
    data[game] = {};

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

    // newGame(game);
}

function initData() {
    loadCount = 0;
    data = {};
    loadData(function(xhr, game) {
        return function () {
            if (xhr.status != 200) {
                loadFail(game);
            } else {
                loadSuccess(game);
    	          var responseText = xhr.responseText;
	              var startGarbage = "data.io.handleScriptLoaded(";
                var jsonString = responseText.slice(startGarbage.length + 1, -2);
	              var jsonData = JSON.parse(jsonString).feed;
                parseJsonData(jsonData);
            }
        }
    });
}

function onReady() {
    initNav();
    initData();
}

$(document).ready(onReady);
