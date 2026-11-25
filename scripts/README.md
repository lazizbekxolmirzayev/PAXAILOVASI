# Map data pipeline

```
git clone --depth 1 https://github.com/nvkelso/natural-earth-vector ne
git clone --depth 1 https://github.com/aourednik/historical-basemaps hb
pip install shapely
python3 scripts/build_provinces.py ne/geojson hb/geojson public/maps bc500,bc200,100,400,800,1000,1200,1279,1400,1492,1530,1650,1715,1815,1880,1914,1938,1945,1960,2000
npx mapshaper /tmp/prov.geojson -clean -simplify 6% weighted keep-shapes -filter-islands min-area=40km2 remove-empty -o format=topojson quantization=20000 public/maps/provinces.topo.json
npx mapshaper /tmp/prov.geojson -simplify 0.8% weighted keep-shapes -filter-islands min-area=3000km2 remove-empty -o format=topojson quantization=8000 public/maps/globe.topo.json
```
Physical layer (rivers, lakes, deserts, mountain ranges) comes from Natural Earth 50m; see commands in the main README.
