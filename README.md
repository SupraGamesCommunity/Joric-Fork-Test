# SupraMaps

* Repository: 
* Live map: https://supragamescommunity.github.io/SupraMaps/

Joric: I didn't do much, all credit goes to [David Münnich](http://www.david-m.org) and [Supra Games Community](https://github.com/supragamescommunity).

## Features

* Supports all games (Supraland, Supraland Crash, Supraland Six Inches Under) and map position/zoom in URL.
* Supports save file uploading to show/hide items you collected (or not collected yet) for all games.
* Accurate and complete item map, ripped from data files (not crowdsourced, see [scripts](https://github.com/joric/supraland/tree/main/scripts) directory).

## Assets

FModel did not work for large maps, so I ended up using a wonderful [UE4Parse](https://github.com/MinshuG/pyUE4Parse) Python library by MountainFlash.

The base map for Six Inches Under is DLC2_Complete.umap, it includes all other submaps internally (look for "LevelTransform" keys).
The base map size is also included in this umap (look for "MapWorldSize").

Supraland Crash doesn't have a map in resources so it was captured in the game engine (not by me) in 2048x2048
([raw_image](https://github.com/SupraGamesCommunity/map-slc/blob/11dc702ece83254fe1de1a567c3c3b890147f95d/img/map.jpg)) 
and then upscaled to 8192x8192. It's probably possible to upscale other maps as well, say to 32768x32768 (4x) with something
like [Upscayl](https://upscayl.github.io) but it's quite slow and the size will be 16x (~256 megs for 3 maps).

## License

This project is an unlicensed public domain, feel free to copy, sell and modify.

## References

* https://github.com/supragamescommunity
* https://github.com/MinshuG/pyUE4Parse


## Project Structure

README.md		Overview documentation
LICENSE			License terms for use of original code/data
index.html		Maps root html page - runs main.js

/tiles			Map tile hierarchy for each game. Each tile is a 512x512 jpg
				{sl|slc|siu}/{base|pads|pipes}/{z}/{x}/{y}.jpg
				where z=zoom [0-4] x/y tile pos within map
				Full maps are 8k. Zoom 0 is 1x1 - Zoom 4 is 16x16
				Only Supraland has pad and pipe maps

/scripts		Utility scripts for working with the data during development
	gentiles.py			Generates map tile hierarchy from a full resolution map image
	run.cmd				CLI script to help launch supraland_parser.py
	supraland_parser.py	Script to extract map data from Supraland UE4 games
						Options for raw data, markers and map textures
	gentiles.py			Utility to split large map into hierarchy of tiles suitable for Leaflet TileLayer

/img			Icons and other images used by custom code
	/markers			Icons specifically for map markers

/js				SupraMaps JS code
	/lib				3rd party dependencies such as Leaflet

/data			Config and object data extracted from games
	/legacy				Old community map data used for non-game elements like YT links

/css			Style sheets for icons, windows etc
	/images				Icon images for most controls
	
## Map Tile and Data Extraction

### Installation

To use the extraction scripts you will need to install/use the following:

DOS Prompt
I recommend "Windows Terminal" but standard CMD is fine as you can configure
a slot specific to working on this project. Scripts do use extensions.

Python
At time of writing this was 3.12 which can be installed from Windows store.
There are also dependencies on some python libraries. Run python then enter
the following commands:

  pip install mathutil aes
  pip install UE4Parse[tex]@git+https://github.com/MinshuG/pyUE4Parse.git
  exit()

VoidTools Everything
Everything is an extremely fast and powerful Windows file search utility
that I highly recommend. It is optional but speeds up one script.

The main utility is here: https://www.voidtools.com/downloads/

The commandline utility (es.exe) is downloaded as a zip and needs to be
put somewhere and added to the path. Personally I unzip it to c:\bin and
then use the commandline:

  setx /M path "%path%;c:\bin"

to add it to system path (drop /M for user path).

ImageMagick
Magick is a very powerful (and complicated) commandline image processing
application. It's great for doing batch operations and there's a ton of
how to's that can be googled. Install it from here:

  https://imagemagick.org/script/download.php#windows

### Usage in General

Make sure you've got SL/SIU installed, open a command prompt with
/scripts as the working directory.

Firt run 'findslpaks' to locate the game install directories and
set some environment variables. If you don't have 'Everything' installed
it will look in 'C:\Program Files (X86)\steam' if your versions are
elsewhere then just do 'findslpaks {path to search}' can be just {drive}:
(don't add trailing \ to path)

To use the extraction python script use the 'run' batch file, it prompts
for different options.

### Extracting Maps and Generating Tiles

The command sequence would be something like this:

findslpaks         > sets up environment
run                > selecting Game then Textures

By default it will put the extracted map textures in %tmp%. They consist
of 4 4096x4096 tiles which need to be merged.

magick montage %tmp%\T_Downscale*.png -tile 2x2 -geometry +0+0 slmap.jpg
magick montage %tmp%\T_SIUMapV7Q*.png -tile 2x2 -geometry +0+0 siumap.jpg

As there's no in game map for Crash that so that needs a copy of the latest
community one. Run.cmd expects this to be called slcmap.jpg

You can then generate the map tile hierarchy 

run					> select Game then Generate tiles

This outputs the hierarchy of tiles to "tiles_dir" so the contents is then
copied to the relevant \tiles\{game}\base directory.

In addition Supraland has tiles\sl\pads|pipes containing tiled versions of
the full size PNGs showing the routes/locations of jumppads and pipes. These
can be generated similarly to the crash tiles if required.

Note on quality: The gentiles.py script currently saves as JPG with low-ish
quality settings which can lead to compression artifacts. This can be changed
by editing the script and finding these lines:

        #tile.save(tile_path, quality=95)
        tile.save(tile_path)

Changing the quality will affect file sizes and thus the repository and the
performance characteristics of the map. Going from the default to 95 will
approximately double the map file sizes.


### Generating Marker Data

This is a two step process. As above use 'findslpaks' to set the directory
environment variables, then the 'run' command. First to extract all the
'levels' data to the %tmp% directory (map.json), and then the second step to
actually build the marker file (markers.{game}.json). Internally the script
has a list of classes we're interested in and dumps the instances with the
following properties (if available):

  name			Name of the instance
  type			Name of the class it instances
  area			Level / map it is attached to
  lat,lng,alt	3D position (x,y,z)
  coins			Number of coins
  cost			Cost to buy
  spawns		What it spawns
  hits			Hits to break
  obsidian		Obsidian?

The name is often the type with _C removed and a number added.

## Custom Data and Legacy Data

In addition to the ap has two custom data files that control behaviour and
also pulls data from copies of files taken from the original community maps.

'layers.csv' says which layers (marker collections/extra maps) should be
available for toggling and whether they should be on by default, and what the
UI should call them.

'types.csv' is a mapping from instance type to the marker icon that should
be used to display it and the layer it should be displayed on. If icon is
not specified ? icon will be used. If layer is not specified 'misc' will be
used.

The legacy files are assumed to be one for each layer, named from the layers.csv id.
So when displaying a marker of id, shops, the map will search shops.csv for an
object with the same position as the marker it is displaying. If found it will
extract the corresponding data (such as YouTube video). At this time it would be
chests.csv, collectables.csv and shops.csv that would be looked at.

Note that coinstash in SIU legacy files and some other data were hand entered
so may not map to extracted data. In particular coinstash are represented as just
loads of coins in SIU.
