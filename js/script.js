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

// function sortItems(menu) {
//     var items = $(menu.selector + " option");
//     items.sort(function(a,b) {
//         if (a.text > b.text) return 1;
//         else if (a.text < b.text) return -1;
//         else return 0
//     });
//     menu.empty().append(items);
//     menu.val(items[0].value);
// }

// Yeah, this "main" thing is kinda dirty. But I suck with Javascript. Should have
// used CoffeScript.
var main;
var loader;
/*
Data format: {
  selectedGame: <GameName>,
  games: {
    <GameName>: {
      selectedMap: <MapName>,
      sectionOrder: [<SectionName>, ...],
      maps: {
        <MapName>: {
          sections: {
            <SectionName>: {
              open: <bool>,
              items: {
                <ItemName>: <ItemValue>,
                ...
              }
            },
            ...
          }
        },
        ...
      }
    },
    ...
  }
}
*/

/*******************************/
var StatusArea = function() {
    this._element = $("#status");
    this._element.hide();
    this._activeElements = 0;
}

StatusArea.prototype._newElement = function() {
    this._activeElements++;
    this._element.slideDown("fast");
}

StatusArea.prototype._delElement = function() {
    this._activeElements--;
    if (this._activeElements == 0) {
        this._element.slideUp();
    }
}

StatusArea.prototype.newWarning = function(text) {
}

StatusArea.prototype.startLoading = function(max, onLoad) {
    this._max = max;
    this._current = 0;
    this._onLoad = onLoad;

	  var progressBar = $("#loading-progress");
	  progressBar.attr('aria-valuemax', max);
    this._newElement();
}

StatusArea.prototype.stopLoading = function() {
    this._delElement();
}

StatusArea.prototype.incrementLoad = function(amount) {
    this._current += amount;
    if (this._current >= this._max) {
        this._onLoad();
        this.stopLoading();
    }
    var progress = this._current / this._max;
    var percent = progress * 100;
    var progressBar = $("#loading-progress").find("div");
    var span = progressBar.find("span");
    progressBar.attr('aria-valuenow', this._current);
    progressBar.css('width', percent + '%');
    span.text(percent + '% Complete');
}

/*******************************/
var StatsArea = function() {
    this._element = $("#stats");
}

StatsArea.prototype.onMapChange = function(sections) {
    this.clear();
    for (section in sections) {
        this.newPanel(section, sections[section]);
    }
}

StatsArea.prototype.clear = function() {
    this._element.empty();
}
StatsArea.prototype.newItem = function (body, itemName, itemTime) {
    var item = $("<div class='item'>");
    var name = $("<span class='item-name'>");
    name.text(itemName);
    var time = $("<span class='item-time'>");
    time.text(itemTime);
    item.append(name);
    item.append(time);
    body.append(item);
}

StatsArea.prototype.newPanel = function(title, section) {
    var open = section.open;
    var items = section.items;

    // Setup panel
    var panel = $("<div class='panel panel-primary'>");
    var heading = $("<div class='panel-heading'>");
    var body = $("<div class='panel-body'>");

    heading.text(title);
    heading.click(function () {
	      if (body.is(":hidden")) {
	          body.slideDown("fast");
            main.setSectionOpen(section, true);
	      } else {
	          body.slideUp("fast");
            main.setSectionOpen(section, false);
	      }
    })
    panel.append(heading);
    panel.append(body);
    this._element.append(panel);

    // Add items to new panel
    var count = 0;
    for (item in items) {
        count++;
        this.newItem(panel.find(".panel-body"), item, items[item]);
    }
    if (count == 0) {
        panel.remove()
    } else {
        if (!open) {
            body.slideUp("fast");
        }
    }
}

/*******************************/
var Main = function() {
    // Assumes document is ready.
    this._gameSelect = $("#game");
    this._mapSelect = $("#map");

    this._gameSelect.change(function() { main.setGame($(this).val()); });
    this._mapSelect.change(function() { main.setMap($(this).val()); });

    this._statusArea = new StatusArea();
    this._statsArea = new StatsArea();
    this._setMapListeners = [ this._statsArea ];
}

function getSortedKeys(obj) {
    var keys = [];
    for (key in obj) {
        keys.push(key);
    }
    keys.sort();
    return keys;
}

Main.prototype.init = function(game) {
    var loaded = function() {
	      console.log("loaded", main._data);
	      main._saveData();

	      // Populate selects
        var games = getSortedKeys(main._data.games);
        for (var i = 0; i < games.length; ++i) {
	          main._gameSelect.append($("<option>").text(games[i]));
        }
        var maps = getSortedKeys(main._data.games[main._data.selectedGame].maps);
        for (var i = 0; i < maps.length; ++i) {
	          main._mapSelect.append($("<option>").text(maps[i]));
        }

	      // Select inital values
	      main.setGame(main._data.selectedGame);
    }

    this._usingLocalStorage = false;
    if(typeof(Storage) !== "undefined") {
	      this._usingLocalStorage = true;
	      this._data = localStorage["data"]
	      if (!this._data) {
	          this._initData(loaded);
	          this._statusArea.newWarning("Hello");
	      } else {
	          this._data = JSON.parse(this._data);
            loaded();
	      }
    } else {
	      this._statusArea.newWarning("Local Storage not supported in this browser.");
	      this._initData(loaded);
    }
}

Main.prototype.setGame = function(game) {
    this._data.selectedGame = game;
	  this._gameSelect.val(game);
    this._saveData();
    this.setMap(this._data.games[game].selectedMap);
}

Main.prototype.setMap = function(map) {
    var game = this._data.selectedGame;

    this._mapSelect.empty();
    var maps = getSortedKeys(this._data.games[game].maps);
    for (var i = 0; i < maps.length; ++i) {
	      this._mapSelect.append($("<option>").text(maps[i]));
    }

    this._data.games[game].selectedMap = map;
	  this._mapSelect.val(map);
    this._saveData();
    var sections = this._data.games[game].maps[map].sections
    for (var i = 0; i < this._setMapListeners.length; ++i) {
        this._setMapListeners[i].onMapChange(sections);
    }
}

Main.prototype.setSectionOpen = function(section, open) {
    section.open = open;
    this._saveData();
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
    this._data.games = {};

    function handleGameWorksheet(json) {
	      console.log("handleGameWorksheet", json);
	      var game = json.title.$t;
	      main._data.games[game] = {};
        var gameObj = main._data.games[game];
        gameObj.maps = {}

	      var columnNames = {};
	      var sectionMap = {};
	      var sections = [];
        var maps = [];
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
                gameObj.sectionOrder = sections;
		            continue;
            }
            maps.push(map);

            gameObj.maps[map] = {}
            var mapObj = gameObj.maps[map];
            mapObj.sections = {};

            for (var i = 0; i < sections.length; ++i) {
                var sectionName = sections[i];
		            mapObj.sections[sectionName] = {}
                var section = mapObj.sections[sectionName];
                section.open = true;
                section.items = {};
            }
            for (var itemIndex = 0; itemIndex < items.length; ++itemIndex) {
		            var item = items[itemIndex];
		            var itemContent = item.split(": ");
		            var name = columnNames[itemContent[0]];
		            if (name == undefined) {
                    name = itemContent[0];
                    console.log("Warning: No translation for '" + name + "'");
		            }
		            var time = itemContent[1];
		            mapObj.sections[sectionMap[name]].items[name] = time;
            }
	      }
        gameObj.selectedMap = maps[0];
	      main._saveData();
        main._statusArea.incrementLoad(1);
    }

    function handleInfoWorksheet(json) {
	      console.log("handleInfoWorksheet", json);
	      var games = [];
        var entries = json.entry;
        for (var entryIndex = 0; entryIndex < entries.length; ++entryIndex) {
            games.push(entries[entryIndex].title.$t);
        }

        main._statusArea.startLoading(games.length, onDoneCallback);
        main._data.selectedGame = games[0];

        for (var gameIndex = 0; gameIndex < games.length; ++gameIndex) {
            var gameName = games[gameIndex]
            var id = gameIndex + 2;
            loadWorksheet(id, handleGameWorksheet, gameName);
        }
    }

    function handleError(game) {
	      console.log("Error loading", game);
        main._statusArea.incrementLoad(1);
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
	          } else {
                main._statusArea.incrementLoad(1);
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
    main.init();
});
