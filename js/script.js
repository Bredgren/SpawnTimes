// TODO:
//  - lazy loading
//  - caching (local storage)
//  - Allow resyncing for each game
//  - Remeber which game and map the user was last at
//  - Remeber sectiosn where opened/closed for each map
//  - Only attempt to auto sync if no local data
//  - Button to check for changes and resync all
//    - store/chcek worksheet modified times

var gameMenu;
var mapMenu;
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

function newPanel(label) {
    var panel = $("<div class='panel panel-primary'>");
    var heading = $("<div class='panel-heading'>");
    var body = $("<div class='panel-body'>");

    heading.text(label);
    heading.click(function () {
	if (body.is(":hidden")) {
	    body.slideDown("fast");
	} else {
	    body.slideUp("fast");
	}
    })
    panel.append(heading);
    panel.append(body);
    statsElement.append(panel);

    return panel;
}

function newItem(body, itemName, itemTime) {
    var item = $("<div class='item'>");
    var name = $("<span class='item-name'>");
    name.text(itemName);
    var time = $("<span class='item-time'>");
    time.text(itemTime);
    item.append(name);
    item.append(time);
    body.append(item);
}

function updateItems() {
    statsElement.empty();

    var sections = data[currentGame].sections;
    for (var sIndex = 0; sIndex < sections.length; ++sIndex) {
        var section = sections[sIndex];
        var panel = newPanel(section);
        var items = data[currentGame][currentMap][section];
        var count = 0;
        for (item in items) {
            count++;
            newItem(panel.find(".panel-body"), item, items[item]);
        }
        if (count == 0) {
            panel.remove()
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

function doneLoading() {
    statusElement.empty();
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

    var percent = loadCount / loadMax * 100;
    var progressBar = $("#loading-progress").find("div");
    var span = progressBar.find("span");
    progressBar.attr('aria-valuenow', loadCount);
    progressBar.css('width', percent + '%');
    span.text(percent + '% Complete');

    if (loadCount == loadMax) {
        doneLoading();
    }
}

function beginLoading(game) {
    var id = game.replace(" ", "-");
    var label = $("<span class='label label-warning' id=" + id + ">")
    label.text(game);
    $("#games-loading").append(label);
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
	    var progressBar = $("#loading-progress");
	    progressBar.attr('aria-valuemax', loadMax);

            for (var gameIndex = 0; gameIndex < games.length; ++gameIndex) {
                var gameName = games[gameIndex]
                beginLoading(gameName);
                var id = gameIndex + 2;
                loadWorksheet(id, onLoadWorksheet, gameName);
            }
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
}

function initData() {
    loadCount = 0;
    data = {};
    loadData(function(xhr, game) {
        return function () {
            if (xhr.status != 200) {
                loadFail(game);
            } else {
    	        var responseText = xhr.responseText;
	        var startGarbage = "data.io.handleScriptLoaded(";
                var jsonString = responseText.slice(startGarbage.length + 1, -2);
	        var jsonData = JSON.parse(jsonString).feed;
                parseJsonData(jsonData);
                loadSuccess(game);
            }
        }
    });
}

function initNav() {
    gameMenu = $("#game");
    gameMenu.change(function() { onChangeGame($(this).val()); });
    mapMenu = $("#map");
    mapMenu.change(function() { onChangeMap($(this).val()); });
    statusElement = $("#load-status")
    statsElement = $("#stats")
}

function onReady() {
    initNav();
    initData();
}

// $(document).ready(onReady);

var main;
/*
Data format:
selectedGame: <GameName>,
<GameName>: {
  selectedMap: <MapName>,
  <MapName>: {
    sectionOrder: [<SectionName>, ...],
    <SectionName>: {
      open: <bool>,
      items: {
        <ItemName>: <ItemValue>,
        ...
      }
    }
    ...
  },
  ...
}
*/

var StatusArea = function() {
    this._element = $("#status");

}

var StatsArea = function() {
    this._element = $("#stats");

}

StatsArea.prototype.onMapChange = function(data) {
    var game = data.selectedGame;
    var map = data[game].selectedMap;
    console.log("StatsArea map change", map);
}

StatsArea.prototype.clear = function() {
    this._element.empty();
}

StatsArea.prototype.newPanel = function(title, data) {
    // Setup panel
    var panel = $("<div class='panel panel-primary'>");
    var heading = $("<div class='panel-heading'>");
    var body = $("<div class='panel-body'>");

    heading.text(label);
    heading.click(function () {
	if (body.is(":hidden")) {
	    body.slideDown("fast");
	} else {
	    body.slideUp("fast");
	}
    })
    panel.append(heading);
    panel.append(body);
    this._element.append(panel);

    // Add items to new panel
    var count = 0;
    for (item in data) {
        count++;
        newItem(panel.find(".panel-body"), item, items[item]);
    }
    if (count == 0) {
        panel.remove()
    }
}

var Main = function() {
    // Assumes document is ready.
    this._gameSelect = $("#game");
    this._mapSelect = $("#map");

    // Yeah, this "main" thing is kinda dirty. Oh well.
    this._gameSelect.change(function() { main.setGame($(this).val()); });
    this._mapSelect.change(function() { main.setMap($(this).val()); });

    this._statusArea = new StatusArea();
    this._statsArea = new StatsArea();
    this._setMapListeners = [ this._statsArea ];


    var loaded = function() {
	console.log("loaded", this._data);
	this._saveData();

	// Populate selects
	this._gameSelect.append($("<option>").text("abc"));
	this._gameSelect.append($("<option>").text("def"));

	// Select inital values
	this._gameSelect.val(this._data.selectedGame);
	this.setGame(this._gameSelect.val());
    }

    this._usingLocalStorage = false;
    if(typeof(Storage) !== "undefined") {
	this._usingLocalStorage = true;
	this._data = localStorage["data"]
	if (!this._data) {
	    this._initData(loaded);
	} else {
	    this._data = JSON.parse(this._data);
	}
    } else {
	this._statusArea.setWarning("Local Storage not supported in this browser.");
	this._initData(loaded);
    }
}

Main.prototype.setGame = function(game) {
    this._data.selectedGame = game;
    this._saveData();
    this.setMap(this._data[game].selectedMap);
}

Main.prototype.setMap = function(map) {
    var game = this._data.selectedGame;
    this._data[game].selectedMap = map;
    this._saveData();
    for (var i = 0; i < this._setMapListeners.length; ++i) {
        this._setMapListeners[i].onMapChange(this._data);
    }
}

Main.prototype.setSectionOpen = function(open) {
 // store new state for the section
 // show/hide section
}

Main.prototype.sync = function() {
  // remember current selected game, selected map, section states
  // clobber data
  // sync all to init data and local storage
    var done = function() {
    }
    this._initData(done);
  // restore selected game, selected map, section states
  // refresh stats area
}

Main.prototype._initData = function(onDoneCallback) {
    console.log("initData");
    this._data = {};

    function handleGameWorksheet(json) {
	console.log("handleGameWorksheet", json);
	var game = json.title.$t;
	main._data[game] = {};

	columnNames = {};
	sectionMap = {};
	sections = [];
	for (var entryIndex = 0; entryIndex < json.entry.length; ++entryIndex) {
            var entry = json.entry[entryIndex];
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
		main._data[game].sectionOrder = sections;
		continue;
            }

            main._data[game][map] = {};
            for (var i = 0; i < sections.length; ++i) {
		main._data[game][map][sections[i]] = {}
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
		main._data[game][map][sectionMap[name]][name] = time;
            }
	}
	main._saveData();
    }

    function handleInfoWorksheet(json) {
	console.log("handleInfoWorksheet", json);
	var games = [];
        var entries = json.entry;
        for (var entryIndex = 0; entryIndex < entries.length; ++entryIndex) {
            games.push(entries[entryIndex].title.$t);
        }

        for (var gameIndex = 0; gameIndex < games.length; ++gameIndex) {
            var gameName = games[gameIndex]
            var id = gameIndex + 2;
            loadWorksheet(id, handleGameWorksheet, gameName);
        }
    }

    function handleError(game) {
	console.log("error loading", game);
    };

    function loadWorksheet(id, onLoad, onError, game) {
	var scope = 'https://spreadsheets.google.com/feeds';
	var key = "1-oPs_owy6LIv3ROirjysRz4Vvap7h7VLdHsglR9m0po";
	var format = '/public/full?alt=json-in-script';
        var url = scope + '/list/' + key + '/' + id + format;
        var xhr = createCORSRequest('GET', url);
        xhr.open('GET', url);
        if (!xhr) {
    	      throw new Error('CORS not supported');
        }
        xhr.onerror = onError;

        xhr.onload = function() {
	    if (xhr.status == 200) {
    		var responseText = xhr.responseText;
		var startGarbage = "data.io.handleScriptLoaded(";
		var jsonString = responseText.slice(startGarbage.length + 1, -2);
		var jsonData = JSON.parse(jsonString).feed;
		onLoad(jsonData);
	    }
	}

        xhr.send();
    }

    loadWorksheet(1, handleInfoWorksheet, "Info");
}

Main.prototype._saveData = function() {
    if (this._usingLocalStorage) {
	localStorage["data"] = JSON.stringify(this._data);
    }
}

Main.prototype._refreshStatsArea = function() {

}

$(document).ready(function() {
    main = new Main();
});
