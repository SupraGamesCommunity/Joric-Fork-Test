var map = null;
var mapId = '';
var localDataName = 'jorics_supraland';
var localData = JSON.parse(localStorage.getItem(localDataName)) || {};
var layers = {};
var classes = {};
var icons = {};
var playerStart;
var playerMarker;

var maps = {
  // data taken from the MapWorld* nodes
  'sl':  { 
      title: 'Supraland',
      "MapWorldCenter": { "X": 13000.0, "Y": -2000.0, "Z": 0.0 },
      "MapWorldSize": 175000.0,
      "MapWorldUpperLeft": { "X": -74500.0, "Y": -89500.0, "Z": 0.0 },
      "MapWorldLowerRight": { "X": 100500.0, "Y": 85500.0, "Z": 0.0 },
   },

  'slc': {
    title: 'Supraland Crash',
      "MapWorldCenter": { "X": 25991.0, "Y": -16.0, "Z": 0.0  },
      "MapWorldSize": 90112.0,
      "MapWorldUpperLeft": { "X": -19065.0, "Y": -45040.0, "Z": 0.0 },
      "MapWorldLowerRight": { "X": 71047.0, "Y": 45072.0, "Z": 0.0 },
   },

  'siu': {
      title: 'Supraland Six Inches Under',
      "MapWorldCenter": { "X": 0.0, "Y": -19000.0, "Z": 10000.0 },
      "MapWorldSize": 147456.0,
      "MapWorldUpperLeft": { "X": -73728.0, "Y": -92728.0, "Z": 10000.0 },
      "MapWorldLowerRight": { "X": 73728.0, "Y": 54728.0, "Z": 10000.0 },
   },
};

window.onload = function(event) {
  mapId = Object.keys(maps).find(id=>location.hash.endsWith(id)) || localStorage.getItem('mapId') || 'sl';
  loadMap();
};

function saveSettings() {
  localStorage.setItem(localDataName, JSON.stringify(localData));
}

function loadMap() {
  localStorage.setItem('mapId', mapId);

  for (id in maps) {
    var title = maps[id].title;
    if (!localData[id]) {
      localData[id] = {};
    }
    if (!localData[id].markedItems) {
      localData[id].markedItems = {};
    }
    if (!localData[id].activeLayers) {
      localData[id].activeLayers = {'closedChest':true, 'shop':true, 'collectable':true};
      if (id=='sl') {
        localData[id].activeLayers['pads']=true;
        localData[id].activeLayers['pipes']=true;
      }
    }
  }

  var mapSize = {width: 8192, height: 8192}
  var tileSize   = {x: 512, y: 512};
  var tileMaxSet = 4;
  var mapMinResolution = Math.pow(2, tileMaxSet);

  document.querySelector('#map').style.backgroundColor = mapId=='siu' ? '#141414' : '#000';

  var w = maps[mapId];

  // fixes 404 errors
  w.MapWorldUpperLeft.X  += 1;
  w.MapWorldUpperLeft.Y += 1;
  w.MapWorldLowerRight.X -= 1;
  w.MapWorldLowerRight.Y -= 1;

  var mapBounds = [
    [ w.MapWorldUpperLeft.Y, w.MapWorldUpperLeft.X ],
    [ w.MapWorldLowerRight.Y, w.MapWorldLowerRight.X ]
  ];

  var m = w.MapWorldSize / mapSize.width;
  var mapScale   = {x: 1.0/m, y: 1.0/m};
  var mapOrigin  = {x: -w.MapWorldUpperLeft.X * mapScale.x, y: -w.MapWorldUpperLeft.Y * mapScale.y};


  // Create a coordinate system for the map
  var crs = L.CRS.Simple;
  crs.transformation = new L.Transformation(mapScale.x, mapOrigin.x, mapScale.y, mapOrigin.y);
  crs.scale = function (zoom) { return Math.pow(2, zoom) / mapMinResolution; };
  crs.zoom = function (scale) { return Math.log(scale * mapMinResolution) / Math.LN2; };

  //Create the map
  map = new L.Map('map', {
    crs: crs,
    fadeAnimation: false,
    maxBounds: mapBounds, // elastic-y map bounds
    zoomControl: false,
  });

  L.control.zoom({ position: 'bottomright'}).addTo(map);
  L.control.fullscreen({ position: 'bottomright', forceSeparateButton: true}).addTo(map);

  layerOptions = {
      tileSize: L.point(tileSize.x, tileSize.y),
      noWrap: true,
      tms: false,
      updateInterval: -1,
      keepBuffer: 16,
      maxNativeZoom: 4,
      nativeZooms: [0, 1, 2, 3, 4],
      edgeBufferTiles: 3,
      bounds: mapBounds,
      attribution: '<a href="https://github.com/joric/supraland" target="_blank">Joric\'s Supraland</a>',
  };

  let layerControl = L.control.layers({}, {}, {
    collapsed: true,
    position: 'topright',
  });

  map.on('baselayerchange', function(e) {
    localStorage.setItem(mapId, location.hash);
    location.hash = '';
    map.off();
    map.remove();
    playerMarker = null;
    mapId = e.layer.mapId;
    loadMap();
  });

  function updateSearch() {
    let searchLayers = [];
    for (id of Object.keys(localData[mapId].markedItems)) {
      searchLayers.push(layers[id]);
    }
    searchControl.setLayer(L.featureGroup(searchLayers));
  }

  map.on('overlayadd', function(e) {
    resizeIcons();
    for (id of Object.keys(localData[mapId].markedItems)) {
      window.markItemFound(id);
    }
    localData[mapId].activeLayers[e.layer.id] = true;
    //console.log(localData[mapId].activeLayers);
    //updateSearch();
    saveSettings();
  });

  map.on('overlayremove', function(e) {
    delete localData[mapId].activeLayers[e.layer.id];
    //console.log(localData[mapId].activeLayers);
    //updateSearch();
    saveSettings();
  });

  map.on('zoomend', function(e) {
    resizeIcons();
  });

  tilesDir = 'tiles/'+mapId;

  // L.tileLayer.canvas() is much faster than L.tileLayer() but requires a L.TileLayer.Canvas plugin
  let baseLayer = L.tileLayer.canvas(tilesDir+'/base/{z}/{x}/{y}.jpg', layerOptions).addTo(map);

  for (id in maps) {
    var title = maps[id].title;
    var layer = id==mapId ? baseLayer : L.layerGroup();
    layer.mapId = id;
    layerControl.addBaseLayer(layer, title);
  }

  if (mapId == 'sl') {
    for (const [id, title] of Object.entries({'pipes':'Pipes', 'pads':'Pads'})) {
      var layer =  L.tileLayer.canvas(tilesDir+'/'+id+'/{z}/{x}/{y}.png', layerOptions);
      layer.id = id;
      if (localData[mapId].activeLayers[id]) {
        layer.addTo(map);
      }
      layerControl.addOverlay(layer, title);
    }
  }

  L.control.mousePosition().addTo(map);

  map.fitBounds(mapBounds);

  if (location.hash == '') {
      location.hash = localStorage.getItem(mapId);
  }

  var hash = new L.Hash(map);

  map.mapId = mapId; // for hash plugin to add mapId


  window.mapref = map;

  function newAction(conf) {
    var ImmediateSubAction = L.Toolbar2.Action.extend({
      initialize: function(map, myAction) {
          this.map = map;
          this.myAction = myAction;
          L.Toolbar2.Action.prototype.initialize.call(this);
      },
      addHooks: function() { this.myAction.disable(); }
    });

    var Cancel = ImmediateSubAction.extend({
        options: {
            toolbarIcon: {
                html: '&times;',
                tooltip: 'Cancel'
            }
        }
    });

    subActions = []

    for (const [title, className] of Object.entries(conf.actions)) {
          a = ImmediateSubAction.extend({
              options: {
                  toolbarIcon: {
                      html: title, //'<img src="img/'+title+'.png"/>',
                      tooltip: title,
                      className: className,
                  },
              },
              addHooks: function() {
                //typeof func === 'function' ? func() : function(){}
                //this.myAction.disable();
              }
          });
        subActions.push(a);
    }

    subActions.push(Cancel);

    return L.Toolbar2.Action.extend({
        options: {
            toolbarIcon: {
                html: conf.icon,
                tooltip: conf.tooltip,
            },
            subToolbar: new L.Toolbar2({ 
                actions: subActions
            })
        }
    });
  }

  actions = []
  actions.push(newAction({icon:'&#x1F4C1;', tooltip:'Upload Save File', actions:{'Instructions':'copy-path', 'Load Game':'upload-save', 'Unmark All': 'unmark-items' }}));
  let toolbar = new L.Toolbar2.Control({actions: actions, position: 'bottomleft'}).addTo(map);

  document.querySelector('.copy-path').onclick = function(e) {
    window.putSavefileLocationOnClipboard();
  }

  document.querySelector('#file').onchange = function(e) {
    window.loadSaveFile();
  }

  document.querySelector('.upload-save').onclick = function(e) {
    document.querySelector('#file').value = null;
    document.querySelector('#file').accept = '.sav';
    document.querySelector('#file').click();
  }

  document.querySelector('.unmark-items').onclick = function(e) {
    if (confirm('Are you sure to unmark all items?')) {
      unmarkItems();
      saveSettings();
    }
  }

  function loadMarkersLegacy() {
    chestIconBig = L.icon({iconUrl: 'img/chest.png', iconSize: [64,64], iconAnchor: [32,32]});
    filename = 'data/legacy/' + mapId + '/chests.csv';
    var loadedCsv = Papa.parse(filename, { download: true, header: true, complete: function(results, filename) {
      var chests = 0;
      for (o of results.data) {
        if (!o.x) {
          continue;
        }
        chests += 1;
        var layer = 'closedChest';
        m = L.marker([o.y, o.x], {icon: chestIconBig, title: o.type, zIndexOffset: -100 }).addTo(layers[layer])
        .bindPopup(JSON.stringify(o, null, 2).replaceAll('\n','<br>').replaceAll(' ','&nbsp;'));
      }
    }});
  }

  function onContextMenu(e) {
    let markerId = e.target.options.alt;
    let found = localData[mapId].markedItems[markerId]==true;
    markItemFound(markerId, !found);
    e.target.closePopup();
  }

  function onPopupOpen(e) {
    let x = e.popup._source._latlng.lng;
    let y = e.popup._source._latlng.lat;
    let type = e.popup._source.options.type;
    let markerId = e.popup._source.options.alt;

    let dist = Infinity;
    let res = null;

    let text = JSON.stringify(e.popup._source.options.o, null, 2).replaceAll('\n','<br>').replaceAll(' ','&nbsp;');

    let found = localData[mapId].markedItems[markerId]==true

    let value = found ? 'checked' : '';

    // it's not "found" but rather "removed" (e.g. BuySword2_2 in the beginning of Crash DLC)
    text += '<br><br><input type="checkbox" id="'+markerId+'" '+value+' onclick=markItemFound("'+markerId+'",this.checked)><label for="'+markerId+'">Found</label>';

    e.popup.setContent(text);

    filename = 'data/legacy/' + mapId + '/'+type+'.csv';
    var loadedCsv = Papa.parse(filename, { download: true, header: true, complete: function(results, filename) {
      var chests = 0;
      for (o of results.data) {
        if (!o.x) {
          continue;
        }

        let d = Math.pow(  Math.pow(o.x-x, 2) + Math.pow(o.y-y, 2), 0.5);

        if (d<dist) {
          dist = d;
          res = o;
        }
      }

      if (dist<1000 && res.ytVideo) {
        let url = 'https://youtu.be/'+res.ytVideo+'&?t='+res.ytStart;
        text += '<br><br><a href="'+url+'" target=_blank>'+url+'</a>'
      }

      e.popup.setContent(text);

    }});

  };

  function loadMarkers() {
    fetch('data/markers.'+mapId+'.json')
      .then((response) => response.json())
      .then((j) => {
        var chests = 0;
        var chests_total = 0;

        objects = {};

        for (o of j) {
          if (c = classes[o.type]) {

            let markerId = o.area + ':' + o.name;

            let text = '';//JSON.stringify(o, null, 2).replaceAll('\n','<br>').replaceAll(' ','&nbsp;');
            let title = o.name;

            if (o.type.endsWith('Chest_C')) {
              chests += 1;
              chests_total += 1;

              let icon = 'chest';

              layer = 'closedChest';

              if (o.spawns) {
                title = title + ' ('+o.spawns+')';
              } else if (o.coins) {
                title = title + ' ('+o.coins+' coin'+(o.coins>1?'s':'')+')';
              }

              L.marker([o.lat, o.lng], {icon: getIcon(icon), title: title, type: 'chests', o:o, zIndexOffset: 100, alt: markerId }).addTo(layers[layer])
              .bindPopup(text)
              .on('popupopen', onPopupOpen)
              .on('contextmenu',onContextMenu)
              ;
            }

            if (o.type.startsWith('Buy') || o.type.startsWith('BP_Buy') || o.type.startsWith('Purchase') || o.type.startsWith('BP_Purchase') || o.type.startsWith('BP_BoneDetector_C')) {
              icon = 'shop';
              layer = 'shop';
              L.marker([o.lat, o.lng], {icon: getIcon(icon), title: title, type: 'shops', o:o, zIndexOffset: 100, alt: markerId }).addTo(layers[layer])
              .bindPopup(text)
              .on('popupopen', onPopupOpen)
              .on('contextmenu',onContextMenu)
              ;
            }


            icon = c.icon;
            layer = c.layer;

            if (s = classes[o.spawns]) {
              icon = s.icon;
              layer = s.layer;
              if (o.spawncount>1) {
                icon = 'coinStash';
              }
            }

            if (icon == '') {
              icon = 'question_mark';
            }

            if (!layers[layer]) {
              layer = 'misc';
            }

            if (o.type == 'PlayerStart' && !playerMarker) {
              playerStart = [o.lat, o.lng, o.alt];
              let t = new L.LatLng(o.lat, o.lng);
              if (p = localData[mapId].playerPosition) {
                t = new L.LatLng(p[0], p[1]);
              }
              playerMarker = L.marker([t.lat, t.lng], {zIndexOffset: 10000, draggable: true, title: Math.round(t.lat)+', '+Math.round(t.lng) })
              .bindPopup()
              .on('moveend', function(e) {
                let marker = e.target;
                let t = marker.getLatLng();
                localData[mapId].playerPosition = [t.lat, t.lng, 0];
                saveSettings();
                e.target._icon.title = Math.round(t.lat)+', '+Math.round(t.lng)
              })
              .on('popupopen', function(e) {
                  let marker = e.target;
                  let t = marker.getLatLng();
                  t = {name:'playerPosition', lat:Math.round(t.lat), lng:Math.round(t.lng)};
                  marker.setPopupContent(JSON.stringify(t, null, 2).replaceAll('\n','<br>').replaceAll(' ','&nbsp;'));
                  marker.openPopup();
              }).addTo(map)
            }

            L.marker([o.lat, o.lng], {icon: getIcon(icon), title: title, type: 'collectables', o:o, zIndexOffset: 100, alt: markerId }).addTo(layers[layer])
            .bindPopup(text)
            .on('popupopen', onPopupOpen)
            .on('contextmenu',onContextMenu)
            //.bindTooltip(function (e) { return String(e.options.title);}, {permanent: true, opacity: 1.0})
            ;
          }

          objects[o.name] = o;

        } // end of loop

        // second pass (pads and pipes)
        for (name of Object.keys(objects)) {
          o = objects[name];

          if (o.type == 'Jumppad_C') {
            if (r = o.rotation) {
              let x1 = o.lng;
              let y1 = o.lat;

              let rx = r.x
              let ry = r.y;
              let rz = r.z;

              let len = 5000;

              if (o.relative_velocity) {
                //len = o.relative_velocity * 5;
              }

              let a = rz + 3.14/2;

              x2 = x1 + len * Math.cos(a);
              y2 = y1 + len * Math.sin(a);

              L.polyline([[y1,x1],[y2,x2]], {color: 'cyan'}).addTo(layers['jumppads']);
            }
          }

          if  (o.other_pipe) {
            if (p = objects[o.other_pipe]) {
              L.polyline([[o.lat, o.lng],[p.lat, p.lng]], {color: 'lawngreen'}).addTo(layers['pipecaps']);
            }
          }
        }

        resizeIcons();
    });

  }

  function loadLayers() {
      playerMarker = null;
      filename = 'data/layers.csv';

      let searchLayers = [];
      let inactiveLayers = [];

      var loadedCsv = Papa.parse(filename, { download: true, header: true, complete: function(results, filename) {
        for (o of results.data) {
          if (!o.id) {
            continue;
          }
          if (o.id=='pipes' || o.id=='pads') {
            continue;
          }
          if (o.id=='graves' && mapId!='sl') {
            continue;
          }

          let layerObj = L.layerGroup();
          layerObj.id = o.id;

          if (localData[mapId].activeLayers[o.id]) {
            layerObj.addTo(map);
          } else {
            inactiveLayers.push(layerObj);
          }

          layers[o.id] = layerObj;
          layerControl.addOverlay(layerObj, o.name);

          searchLayers.push(layerObj);
        }


        searchControl = new L.Control.Search({
            //layer: L.featureGroup(searchLayers),
            //layer: layers['closedChest'],
            //layer: searchLayers[0],
            marker: false, // no red circle
            initial: false, // search any substring
            firstTipSubmit: true,
            layer: L.featureGroup( searchLayers ),
        }).addTo(map);

        for (layer of inactiveLayers) { layer.remove(); }

        //console.log(layers);

        searchControl.on("search:locationfound", function (e) {
            if (e.layer._popup) e.layer.openPopup();
            //console.log(e.target._leaflet_id);
            //TODO: show layer by marker
        });


        filename = 'data/types.csv';
        Papa.parse(filename, { download: true, header: true, complete: function(results, filename) {
          for (o of results.data) {
            if (!o.type) {
              continue;
            }
            classes[o.type] = o;
          }

          //loadMarkersLegacy();
          loadMarkers();

          layerControl.addTo(map); // triggers baselayerchange, so called in the end

        }});
      }});
  }

  loadLayers();

  window.addEventListener("keydown",function (e) {
    //console.log(e);
    if (e.code=='KeyF') {
      if (e.ctrlKey) {
        searchControl.expand(true);
        e.preventDefault();
      } else if (!e.target.id.startsWith('searchtext')) {
        map.toggleFullscreen();
      }
    }
  });
} // end of loadmap

function getIconSize(zoom) {
  let s = [16,16,24,32,32,32,48,48,64];
  return s[Math.round(Math.min(zoom,s.length-1))];
}

function getIcon(icon) {
  let iconObj = icons[icon];
  if (!iconObj) {
    let s = getIconSize(map.getZoom());
    let c = s >> 1;
    iconObj = L.icon({iconUrl: 'img/'+icon+'.png', iconSize: [s,s], iconAnchor: [c,c]});
    icons[icon] = iconObj;
  }
  return iconObj;
}

function resizeIcons() {
    map.eachLayer(function(layer) {
      if (layer instanceof L.Marker) {
        //let icon = layer.getIcon(); // undefined in 1.3
        let icon = layer.options.icon;
        if (icon.options.iconUrl!='marker-icon.png') {
          let s = getIconSize(map.getZoom());
          let c = s >> 1;
          icon.options.iconSize = [s,s];
          icon.options.iconAnchor = [c,c];
          layer.setIcon(icon);
        }
      }
   });

  markItems();
}

window.markItemFound = function (id, found=true, save=true) {
  var divs = document.querySelectorAll('img[alt="' + id + '"]');

  [].forEach.call(divs, function(div) {
    if (found) {
      div.classList.add('found');
    } else {
      div.classList.remove('found');
    }
  });

  if (found) {
    localData[mapId].markedItems[id] = true;
  } else {
    delete localData[mapId].markedItems[id];
  }

  if (save) {
    saveSettings();
  }
}

function markItems() {
  for (const[id,value] of Object.entries(localData[mapId].markedItems)) {
    var divs = document.querySelectorAll('img[alt="' + id + '"]');
    [].forEach.call(divs, function(div) {
      div.classList.add('found');
    });
  }
}

function unmarkItems() {
  for (const[id,value] of Object.entries(localData[mapId].markedItems)) {
    var divs = document.querySelectorAll('img[alt="' + id + '"]');
    [].forEach.call(divs, function(div) {
      div.classList.remove('found');
    });
  }
  localData[mapId].markedItems={};
  localData[mapId].playerPosition = playerStart;
  if (playerMarker) {
    playerMarker.setLatLng(new L.LatLng(playerStart[0], playerStart[1]));
  }
}

window.loadSaveFile = function () {
  let file = document.querySelector('#file').files[0];

  let self = this;
  let ready = false;
  let result = '';

  const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  self.readAsArrayBuffer = async function() {
      while (ready === false) {
        await sleep(100);
      }
      return result;
  }

  const reader = new FileReader();

  reader.onloadend = function(evt) {

    let loadedSave = new UESaveObject(evt.target.result);

    //console.log(loadedSave);
    //unmarkItems();

    for (let section of ["ThingsToRemove", "ThingsToActivate", "ThingsToOpenForever"]) {
      for (o of loadedSave.Properties) {
        if (o.name != section) {
          continue;
        }
        for(x of o.value.value) {
          // map '/Game/FirstPersonBP/Maps/DLC2_Complete.DLC2_Complete:PersistentLevel.Coin442_41' to 'DLC2_Complete:Coin442_41'
          let name = x.split(".").pop();
          let area = x.split("/").pop().split('.')[0];
          if (name != "None") {
            markItemFound(area + ':' + name, true, false);
          }
        }
      }
    }

    for (o of loadedSave.Properties) {
      if (o.name == 'Player Position' && playerMarker) {
        let c = [0,0,0]
        let p = o.value;
        if (o.value.type=='Vector' || o.value.type=='Transform') {
          if (o.value.translation) {
            p = o.value.translation;
          }
          var latlng = new L.LatLng(p.y, p.x);
          //console.log('setting player position from file', mapId, latlng);
          playerMarker.setLatLng(latlng);
          localData[mapId].playerPosition = [p.y, p.x, p.z];
        } else {
          console.log('cannot load player position from', JSON.stringify(o));
        }
      }
    }

    //alert('Marked ' + Object.keys(localData[mapId].markedItems).length + ' items');
    console.log('Marked ' + Object.keys(localData[mapId].markedItems).length + ' items');

    saveSettings();

    ready = true;
  };

  if (file instanceof Blob) {
    reader.readAsArrayBuffer(file);
  }
}

window.putSavefileLocationOnClipboard = function() {
  let location = '%LocalAppData%\\Supraland'+(map.mapId=='siu' ? 'SIU':'')+'\\Saved\\SaveGames';

  let text = 
  'This map allows you to import the game save file (latest .sav) to mark the collected items automatically. '+
  'On Windows, the default save path for this game is "'+location+'". '+
  'Click OK to copy the path to your clipboard.'
  ;

  if (confirm(text)) {
    let inputc = document.body.appendChild(document.createElement("input"));
    inputc.value = location;
    inputc.focus();
    inputc.select();
    document.execCommand('copy');
    inputc.parentNode.removeChild(inputc);
  }
}
