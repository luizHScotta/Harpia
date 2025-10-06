import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layer } from "./LayerControl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Box, Cuboid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Mapbox token configured
const MAPBOX_TOKEN = "pk.eyJ1IjoiYW5kcmV3b2J4IiwiYSI6ImNtMWh2MXZ5eDBqNnQyeG9za2R1N2lwc2YifQ.7yCrlwa4nNFKpg2TcQoFQg";
interface MapViewProps {
  layers: Layer[];
  onFeatureClick: (data: any) => void;
  onAOIChange: (aoi: any) => void;
  onSearchComplete: (handleSearch: (start: string, end: string) => Promise<void>, isSearching: boolean, results?: any[], imageSelectFn?: (result: any, collection: string) => void) => void;
}
interface SatelliteLayer {
  id: string;
  type: 'sentinel1' | 'sentinel2';
  url: string;
  bbox: number[];
  opacity?: number;
}
const MapView = ({
  layers,
  onFeatureClick,
  onAOIChange,
  onSearchComplete
}: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [currentImageResult, setCurrentImageResult] = useState<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const imageCache = useRef<Map<string, string>>(new Map());
  console.log("MapView render - mapLoaded:", mapLoaded);
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    console.log("🗺️ Inicializando Mapbox...");
    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-48.5044, -1.4558],
        zoom: 11,
        pitch: 0,
        antialias: true
      });
      
      console.log("✅ Mapbox map criado");

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl({
        visualizePitch: true
      }), "top-right");

      // Add scale control
      map.current.addControl(new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: "metric"
      }), "bottom-right");

      // Add drawing controls
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: false
        },
        defaultMode: 'simple_select'
      });
      map.current.addControl(draw.current, "top-left");

      // Listen to draw events
      map.current.on('draw.create', updateArea);
      map.current.on('draw.delete', updateArea);
      map.current.on('draw.update', updateArea);
      
      function updateArea() {
        const data = draw.current?.getAll();
        if (data && data.features.length > 0) {
          if (data.features.length > 1) {
            const latestFeature = data.features[data.features.length - 1];
            data.features.slice(0, -1).forEach(feature => {
              draw.current?.delete(feature.id as string);
            });
            setCurrentAOI(latestFeature.geometry);
            onAOIChange(latestFeature.geometry);
            console.log("📍 AOI updated (latest only):", latestFeature.geometry);
          } else {
            const polygon = data.features[0];
            setCurrentAOI(polygon.geometry);
            onAOIChange(polygon.geometry);
            console.log("📍 AOI updated:", polygon.geometry);
          }
        } else {
          setCurrentAOI(null);
          onAOIChange(null);
          removeImageOverlay();
        }
      }
      
      map.current.on("load", () => {
        console.log("✅ Mapbox map carregado completamente");
        setMapLoaded(true);

        if (map.current) {
          // Add example polygon for Belém baixadas
          map.current.addSource("belem-areas", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                properties: {
                  name: "Região da Baixada - Fazendinha",
                  population: 45000,
                  floodRisk: "Alto",
                  avgNDVI: 0.35,
                  avgLST: 32.5,
                  sanitation: 45
                },
                geometry: {
                  type: "Polygon",
                  coordinates: [[[-48.52, -1.47], [-48.49, -1.47], [-48.49, -1.44], [-48.52, -1.44], [-48.52, -1.47]]]
                }
              }]
            }
          });
          
          map.current.addLayer({
            id: "belem-areas-fill",
            type: "fill",
            source: "belem-areas",
            paint: {
              "fill-color": "#1eb8b8",
              "fill-opacity": 0.2
            }
          });
          
          map.current.addLayer({
            id: "belem-areas-outline",
            type: "line",
            source: "belem-areas",
            paint: {
              "line-color": "#1eb8b8",
              "line-width": 2
            }
          });

          map.current.on("click", "belem-areas-fill", e => {
            if (e.features && e.features[0]) {
              onFeatureClick(e.features[0].properties);
            }
          });

          map.current.on("mouseenter", "belem-areas-fill", () => {
            if (map.current) map.current.getCanvas().style.cursor = "pointer";
          });
          
          map.current.on("mouseleave", "belem-areas-fill", () => {
            if (map.current) map.current.getCanvas().style.cursor = "";
          });
        }
      });
      
      map.current.on("error", (e) => {
        console.error("❌ Mapbox error:", e);
      });
      
    } catch (error) {
      console.error("❌ Erro ao inicializar mapa:", error);
      toast.error("Erro ao carregar o mapa");
    }
    
    return () => {
      console.log("🧹 Limpando mapa...");
      map.current?.remove();
    };
  }, []);

  // Update layer visibility and opacity based on selected layers
  useEffect(() => {
    if (!mapLoaded || !map.current || !currentAOI || !currentImageResult) return;
    const activeLayers = layers.filter(l => l.enabled);
    console.log("Active layers:", activeLayers.map(l => l.name));

    // Update image based on active layers
    updateImageOverlay(currentImageResult, activeLayers);
  }, [layers, mapLoaded, currentAOI, currentImageResult]);
  const clearAllPolygons = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setCurrentAOI(null);
      setCurrentImageResult(null);
      removeImageOverlay();
      toast.success("Todos os polígonos removidos");
    }
  };
  const toggle3DMode = () => {
    if (!map.current || !mapLoaded) {
      console.log("Map not ready for 3D toggle");
      return;
    }

    try {
      const new3DState = !is3DMode;
      setIs3DMode(new3DState);

      if (new3DState) {
        console.log("Activating 3D mode...");
        
        // Verificar satélites compatíveis com modo 3D
        const compatible3DSatellites = [
          'nasa-worldview', 
          'usgs-imagery', 
          'sentinel1-vv', 
          'sentinel1-vh',
          'flood',
          'water-index'
        ];
        
        const activeLayers = layers.filter(l => l.enabled);
        const activeIncompatible = activeLayers
          .filter(layer => !compatible3DSatellites.includes(layer.id))
          .map(layer => layer.name);

        if (activeIncompatible.length > 0) {
          toast.info(
            `Modo 3D ativado`,
            {
              description: `Apenas satélites compatíveis (NASA Worldview, USGS, Sentinel-1) serão exibidos no modo 3D`
            }
          );
        }
        
        // Add terrain source
        if (!map.current.getSource('mapbox-dem')) {
          map.current.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.terrain-rgb',
            tileSize: 512,
            maxzoom: 14
          });
        }

        // Set terrain
        map.current.setTerrain({ 
          source: 'mapbox-dem', 
          exaggeration: 2.5 
        });

        // Add elevation-based fill layer
        // Red = low elevation (valleys), Blue = high elevation (peaks)
        if (!map.current.getLayer('elevation-fill')) {
          map.current.addLayer({
            id: 'elevation-fill',
            type: 'fill-extrusion',
            source: 'mapbox-dem',
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'ele'],
                0, '#ff0000',      // Sea level - Red
                500, '#ffaa00',    // 500m - Orange
                1000, '#ffff00',   // 1000m - Yellow
                2000, '#00ff00',   // 2000m - Green
                3000, '#00aaff',   // 3000m - Light Blue
                5000, '#0000ff'    // 5000m+ - Deep Blue
              ],
              'fill-extrusion-opacity': 0.6,
              'fill-extrusion-height': ['get', 'ele']
            }
          });
        }
        
        // Add hillshade for terrain relief
        if (!map.current.getLayer('hillshade')) {
          map.current.addLayer({
            id: 'hillshade',
            type: 'hillshade',
            source: 'mapbox-dem',
            paint: {
              'hillshade-exaggeration': 0.5,
              'hillshade-shadow-color': '#000000',
              'hillshade-highlight-color': '#ffffff'
            }
          });
        }

        // Add 3D buildings with elevation-based coloring
        if (!map.current.getLayer('3d-buildings')) {
          map.current.addLayer({
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'height'],
                0, '#e74c3c',    // Red for low buildings
                50, '#f39c12',   // Yellow for medium
                100, '#3498db'   // Blue for tall buildings
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0,
                12.05, ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                12, 0,
                12.05, ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 0.7
            }
          });
        }

        // Add NASA Worldview (MODIS) layer - using correct date format
        const today = new Date().toISOString().split('T')[0];
        if (!map.current.getSource('nasa-worldview')) {
          map.current.addSource('nasa-worldview', {
            type: 'raster',
            tiles: [
              `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${today}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
            ],
            tileSize: 256
          });
        }

        if (!map.current.getLayer('nasa-worldview-layer')) {
          map.current.addLayer({
            id: 'nasa-worldview-layer',
            type: 'raster',
            source: 'nasa-worldview',
            paint: {
              'raster-opacity': 0.5
            }
          }, 'hillshade');
        }

        // Add USGS Imagery layer
        if (!map.current.getSource('usgs-imagery')) {
          map.current.addSource('usgs-imagery', {
            type: 'raster',
            tiles: [
              'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256
          });
        }

        if (!map.current.getLayer('usgs-imagery-layer')) {
          map.current.addLayer({
            id: 'usgs-imagery-layer',
            type: 'raster',
            source: 'usgs-imagery',
            paint: {
              'raster-opacity': 0.3
            }
          }, 'hillshade');
        }

        // Add sky layer
        if (!map.current.getLayer('sky')) {
          map.current.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 90.0],
              'sky-atmosphere-sun-intensity': 15
            }
          });
        }

        // Animate camera
        map.current.easeTo({
          pitch: 70,
          bearing: -30,
          duration: 2000
        });

        toast.success("Modo 3D ativado");
      } else {
        console.log("Deactivating 3D mode...");
        
        // Remove terrain first
        if (map.current.getTerrain()) {
          map.current.setTerrain(null);
        }

        // Remove 3D layers in reverse order
        const layersToRemove = ['sky', '3d-buildings', 'usgs-imagery-layer', 'nasa-worldview-layer', 'hillshade'];
        layersToRemove.forEach(layerId => {
          if (map.current?.getLayer(layerId)) {
            try {
              map.current.removeLayer(layerId);
              console.log(`Removed layer: ${layerId}`);
            } catch (e) {
              console.warn(`Could not remove layer ${layerId}:`, e);
            }
          }
        });

        // Wait a bit before removing sources
        setTimeout(() => {
          if (!map.current) return;
          
          const sourcesToRemove = ['usgs-imagery', 'nasa-worldview', 'mapbox-dem'];
          sourcesToRemove.forEach(sourceId => {
            if (map.current?.getSource(sourceId)) {
              try {
                map.current.removeSource(sourceId);
                console.log(`Removed source: ${sourceId}`);
              } catch (e) {
                console.warn(`Could not remove source ${sourceId}:`, e);
              }
            }
          });
        }, 100);

        // Reset camera
        map.current.easeTo({
          pitch: 0,
          bearing: 0,
          duration: 1000
        });

        toast.success("Modo 2D ativado");
      }
    } catch (error) {
      console.error("Error toggling 3D mode:", error);
      toast.error("Erro ao alternar modo 3D");
    }
  };
  const removeImageOverlay = () => {
    if (!map.current) return;
    const mapInstance = map.current;

    // Remover todos os markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Remove all SAR overlays (pode ter múltiplos agora)
    let layerIndex = 0;
    while (true) {
      const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
      const sourceId = `${layerId}-source`;
      try {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId);
          if (mapInstance.getSource(sourceId)) {
            mapInstance.removeSource(sourceId);
          }
          layerIndex++;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }
    console.log("🗑️ All image overlays and markers removed");
  };
  const clipImageToPolygon = async (imageUrl: string, bbox: number[], polygonCoords: number[][]): Promise<string> => {
    const cacheKey = `${imageUrl}-${JSON.stringify(polygonCoords)}`;

    // Verificar cache
    if (imageCache.current.has(cacheKey)) {
      console.log("✅ Using cached clipped image");
      return imageCache.current.get(cacheKey)!;
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');

          // Configurar tamanho do canvas baseado na imagem
          canvas.width = img.width;
          canvas.height = img.height;
          const [west, south, east, north] = bbox;
          const bboxWidth = east - west;
          const bboxHeight = north - south;

          // Converter coordenadas do polígono para pixels do canvas
          const pixelCoords = polygonCoords.map(([lng, lat]) => {
            const x = (lng - west) / bboxWidth * canvas.width;
            const y = (north - lat) / bboxHeight * canvas.height;
            return [x, y];
          });

          // Aplicar clip path do polígono
          ctx.beginPath();
          pixelCoords.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();

          // Desenhar imagem com clip aplicado
          ctx.drawImage(img, 0, 0);

          // Converter para data URL
          const clippedImageUrl = canvas.toDataURL('image/png');

          // Armazenar em cache
          imageCache.current.set(cacheKey, clippedImageUrl);
          console.log("✅ Image clipped and cached");
          resolve(clippedImageUrl);
        } catch (error) {
          console.error('❌ Error clipping image:', error);
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  };

  // Função auxiliar para obter nome abreviado da coleção
  const getCollectionDisplayName = (collection: string) => {
    const names: Record<string, string> = {
      'sentinel-1-grd': 'S1',
      'sentinel-2-l2a': 'S2',
      'landsat-c2-l2': 'Landsat',
      'cop-dem-glo-30': 'COP-DEM',
      'nasadem': 'NASA-DEM',
      'alos-dem': 'ALOS',
      'modis-09Q1-061': 'MODIS-R',
      'modis-13A1-061': 'MODIS-V',
      'modis-17A3HGF-061': 'MODIS-B',
      'modis-11A1-061': 'MODIS-T',
      'hgb': 'Biomass',
      'esa-worldcover': 'ESA-WC'
    };
    return names[collection] || collection;
  };
  const updateImageOverlay = async (result: any, activeLayers: Layer[], layerIndex: number = 0, collection?: string) => {
    if (!map.current || !result || !currentAOI) return;
    const mapInstance = map.current;

    // Mapear coleção para camadas correspondentes
    const collectionToLayers: Record<string, string[]> = {
      'sentinel-1-grd': ['sentinel1-vv', 'sentinel1-vh'],
      'sentinel-2-l2a': ['sentinel2'],
      'landsat-c2-l2': ['landsat'],
      'cop-dem-glo-30': ['dem'],
      'nasadem': ['nasadem'],
      'alos-dem': ['alosdem'],
      'modis-09Q1-061': ['modis-reflectance'],
      'modis-13A1-061': ['modis-vegetation'],
      'modis-17A3HGF-061': ['modis-biomass'],
      'modis-11A1-061': ['modis-temperature'],
      'hgb': ['global-biomass'],
      'esa-worldcover': ['esa-worldcover'],
      // índices processados
      'index-ndvi': ['ndvi'],
      'index-flood': ['flood']
    };

    // Verificar se alguma camada correspondente à coleção está ativa
    const requiredLayers = collectionToLayers[collection || result.collection] || [];
    const hasActiveLayer = requiredLayers.some(layerId => 
      activeLayers.some(l => l.id === layerId)
    );

    if (!hasActiveLayer) {
      console.log(`⚠️ No active layer for collection ${collection || result.collection}`);
      return;
    }

    let imageUrl = null;
    let opacity = 0.75;
    console.log("🔍 updateImageOverlay - result:", result, "collection:", collection);

    // Carregar imagem baseada na coleção
    if (collection === 'sentinel-1-grd' || result.collection === 'sentinel-1-grd') {
      const hasSentinel1VV = activeLayers.some(l => l.id === 'sentinel1-vv');
      const hasSentinel1VH = activeLayers.some(l => l.id === 'sentinel1-vh');
      
      imageUrl = result.assets?.rendered_preview?.href;
      if (hasSentinel1VV && hasSentinel1VH) {
        opacity = Math.max(
          activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
          activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
        ) / 100;
      } else if (hasSentinel1VV) {
        opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
      } else if (hasSentinel1VH) {
        opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
      }
      console.log("✅ Using Sentinel-1:", imageUrl);
    } else if (collection === 'sentinel-2-l2a') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item=${result.id}&assets=visual&format=png`;
      opacity = (activeLayers.find(l => l.id === 'sentinel2')?.opacity || 80) / 100;
      console.log("✅ Using Sentinel-2:", imageUrl);
    } else if (collection === 'landsat-c2-l2') {
      imageUrl = result.assets?.rendered_preview?.href || result.assets?.visual?.href || `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=landsat-c2-l2&item=${result.id}&assets=red&assets=green&assets=blue&rescale=0,30000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'landsat')?.opacity || 80) / 100;
      console.log("✅ Using Landsat:", imageUrl);
    } else if (collection === 'cop-dem-glo-30') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=cop-dem-glo-30&item=${result.id}&assets=data&colormap=terrain&rescale=-100,3000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'dem')?.opacity || 70) / 100;
      console.log("✅ Using DEM:", imageUrl);
    } else if (collection === 'nasadem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=nasadem&item=${result.id}&assets=elevation&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'nasadem')?.opacity || 70) / 100;
      console.log("✅ Using NASA DEM:", imageUrl);
    } else if (collection === 'alos-dem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=alos-dem&item=${result.id}&assets=data&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'alosdem')?.opacity || 70) / 100;
      console.log("✅ Using ALOS DEM:", imageUrl);
    } else if (collection === 'modis-09Q1-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-09Q1-061&item=${result.id}&assets=sur_refl_b01&assets=sur_refl_b02&colormap=viridis&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-reflectance')?.opacity || 80) / 100;
      console.log("✅ Using MODIS Reflectance:", imageUrl);
    } else if (collection === 'modis-13A1-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-13A1-061&item=${result.id}&assets=500m_16_days_NDVI&colormap=greens&rescale=0,10000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-vegetation')?.opacity || 75) / 100;
      console.log("✅ Using MODIS Vegetation:", imageUrl);
    } else if (collection === 'modis-17A3HGF-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-17A3HGF-061&item=${result.id}&assets=Npp&colormap=greens&rescale=0,5000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-biomass')?.opacity || 70) / 100;
      console.log("✅ Using MODIS Biomass:", imageUrl);
    } else if (collection === 'modis-11A1-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-11A1-061&item=${result.id}&assets=LST_Day_1km&colormap=thermal&rescale=13000,16000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-temperature')?.opacity || 65) / 100;
      console.log("✅ Using MODIS Temperature:", imageUrl);
    } else if (collection === 'hgb') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=hgb&item=${result.id}&assets=aboveground_biomass&colormap=viridis&rescale=0,300&format=png`;
      opacity = (activeLayers.find(l => l.id === 'global-biomass')?.opacity || 70) / 100;
      console.log("✅ Using Global Biomass:", imageUrl);
    } else if (collection === 'esa-worldcover') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=esa-worldcover&item=${result.id}&assets=map&format=png`;
      opacity = (activeLayers.find(l => l.id === 'esa-worldcover')?.opacity || 75) / 100;
      console.log("✅ Using ESA WorldCover:", imageUrl);
    } else if (collection === 'index-ndvi') {
      // Resultado de process-water-index traz tileUrl; vamos renderizar uma imagem preview do tile para recorte
      imageUrl = `${result.tileUrl.replace('{z}/{x}/{y}', '8/156/234')}`; // tile sample
      opacity = (activeLayers.find(l => l.id === 'ndvi')?.opacity || 70) / 100;
      console.log("✅ Using NDVI tiles:", imageUrl);
    } else if (collection === 'index-flood') {
      imageUrl = `${result.tileUrl.replace('{z}/{x}/{y}', '8/156/234')}`;
      opacity = (activeLayers.find(l => l.id === 'flood')?.opacity || 65) / 100;
      console.log("✅ Using SAR water tiles:", imageUrl);
    } else {
      console.log("⚠️ No matching collection for active layers");
      return;
    }
    if (!imageUrl) {
      console.error("❌ No image URL available");
      return;
    }
    console.log("🌍 Image URL to load:", imageUrl);
    const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
    const sourceId = `${layerId}-source`;
    try {
      // Remove old overlay if exists
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
        console.log(`🗑️ Removed old layer: ${layerId}`);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
        console.log(`🗑️ Removed old source: ${sourceId}`);
      }
      const [west, south, east, north] = result.bbox;
      console.log("📦 BBox:", {
        west,
        south,
        east,
        north
      });

      // Recortar imagem pelo polígono se disponível
      let finalImageUrl = imageUrl;
      if (currentAOI?.geometry?.coordinates?.[0]) {
        const polygonCoords = currentAOI.geometry.coordinates[0];
        finalImageUrl = await clipImageToPolygon(imageUrl, result.bbox, polygonCoords);
        console.log("✂️ Image clipped to polygon");
      } else {
        console.log("⚠️ No AOI polygon available, using full image");
      }

      // Add image source
      mapInstance.addSource(sourceId, {
        type: 'image',
        url: finalImageUrl,
        coordinates: [[west, north], [east, north], [east, south], [west, south]]
      });
      console.log(`✅ Added clipped image source: ${sourceId}`);

      // Add raster layer with dynamic opacity
      // Colocar acima do terreno 3D se existir
      const layers = mapInstance.getStyle().layers;
      const firstSymbolId = layers?.find(layer => layer.type === 'symbol')?.id;
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300,
          'raster-resampling': 'linear'
        }
      }, firstSymbolId);

      // Adicionar marker com badge identificando o satélite
      const [minLng, minLat, maxLng, maxLat] = result.bbox;
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      const el = document.createElement('div');
      el.className = 'satellite-badge';
      el.innerHTML = `<span class="badge-content">${getCollectionDisplayName(collection || result.collection)}</span>`;
      el.style.cssText = `
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        cursor: pointer;
        white-space: nowrap;
        border: 1px solid hsl(var(--primary) / 0.5);
      `;
      const marker = new mapboxgl.Marker({
        element: el
      }).setLngLat([centerLng, centerLat]).addTo(mapInstance);
      markersRef.current.push(marker);
      console.log(`✅ Image overlay ${layerIndex} added successfully with badge - opacity: ${opacity}`);
      toast.success("Imagem recortada sobreposta ao mapa", {
        description: `${getCollectionDisplayName(collection || result.collection)} - Opacidade: ${Math.round(opacity * 100)}%`
      });
    } catch (error) {
      console.error(`❌ Error updating image overlay ${layerIndex}:`, error);
      toast.error("Erro ao carregar overlay", {
        description: "Verifique o console para detalhes"
      });
    }
  };
  const handleResultSelect = async (result: any, collection?: string, isMultiple: boolean = false, index: number = 0) => {
    console.log("🎯 Selected result:", result, "Collection:", collection);
    if (!map.current || !mapLoaded) {
      toast.error("Aguarde o mapa carregar");
      return;
    }
    try {
      if (!isMultiple) {
        // Single image: replace current
        setCurrentImageResult(result);
        removeImageOverlay();
      }
      const activeLayers = layers.filter(l => l.enabled);
      await updateImageOverlay(result, activeLayers, index, collection);
      if (!isMultiple) {
        toast.success("Imagem carregada", {
          description: `${result.collection} - ${new Date(result.datetime).toLocaleDateString('pt-BR')}`
        });
        onFeatureClick({
          name: result.id,
          date: new Date(result.datetime).toLocaleDateString('pt-BR'),
          platform: result.platform,
          polarizations: result.polarizations?.join(', ') || 'N/A',
          mode: result.instrumentMode,
          collection: result.collection
        });
      }
    } catch (error) {
      console.error("❌ Error loading image:", error);
      if (!isMultiple) {
        toast.error("Erro ao carregar imagem");
      }
    }
  };
  const handleSearch = async (startDate: string, endDate: string) => {
    console.log("🔍 handleSearch called - currentAOI:", currentAOI);
    if (!currentAOI) {
      toast.error("Defina uma área de interesse no mapa", {
        description: "Use a ferramenta de desenho para criar um polígono"
      });
      return;
    }
    const activeLayers = layers.filter(l => l.enabled);
    const hasSentinel1 = activeLayers.some(l => l.id.startsWith('sentinel1'));
    const activeCollections = getActiveCollections();
    setIsSearching(true);
    try {
      const startISO = new Date(startDate + 'T00:00:00Z').toISOString();
      const endISO = new Date(endDate + 'T23:59:59Z').toISOString();
      const searchPromises = [];

      // Buscar Sentinel-1 se estiver ativo
      if (hasSentinel1) {
        const sentinel1Promise = supabase.functions.invoke('search-sentinel1', {
          body: {
            aoi: currentAOI,
            startDate: startISO,
            endDate: endISO,
            maxResults: 50,
            collection: 'sentinel-1-grd'
          }
        }).then(response => ({
          ...response,
          collection: 'sentinel-1-grd'
        }));
        searchPromises.push(sentinel1Promise);
      }

      // Buscar outras coleções ativas
      for (const collection of activeCollections) {
        if (collection !== 'sentinel-1-grd') {
          const promise = supabase.functions.invoke('search-planetary-data', {
            body: {
              aoi: currentAOI,
              startDate: startISO,
              endDate: endISO,
              maxResults: 50,
              collection: collection
            }
          }).then(response => ({
            ...response,
            collection: collection
          }));
          searchPromises.push(promise);
        }
      }

      // Integração de índices (Planetary Computer TiTiler via process-water-index)
      const hasNDVI = activeLayers.some(l => l.id === 'ndvi');
      if (hasNDVI) {
        const ndviPromise = supabase.functions.invoke('process-water-index', {
          body: {
            aoi: currentAOI,
            startDate: startISO,
            endDate: endISO,
            collection: 'sentinel-2-l2a',
            indexType: 'ndvi',
            threshold: 0.2
          }
        }).then(response => ({
          ...response,
          collection: 'index-ndvi'
        }));
        searchPromises.push(ndviPromise);
      }

      const hasFlood = activeLayers.some(l => l.id === 'flood');
      if (hasFlood && hasSentinel1) {
        const floodPromise = supabase.functions.invoke('process-water-index', {
          body: {
            aoi: currentAOI,
            startDate: startISO,
            endDate: endISO,
            collection: 'sentinel-1-grd',
            indexType: 'sar-water',
            threshold: -15
          }
        }).then(response => ({
          ...response,
          collection: 'index-flood'
        }));
        searchPromises.push(floodPromise);
      }

      // Executar todas as buscas em paralelo
      const results = await Promise.all(searchPromises);

      // Agregar todos os resultados
      let allResults: any[] = [];
      let totalCount = 0;
      let hasError = false;
      for (const result of results) {
        if (result.error) {
          console.error(`Erro ao buscar ${result.collection}:`, result.error);
          hasError = true;
          continue;
        }
        if (result.data?.success && result.data.results?.length > 0) {
          // Adicionar a coleção a cada resultado para identificação
          const resultsWithCollection = result.data.results.map((r: any) => ({
            ...r,
            searchCollection: result.collection
          }));
          allResults = [...allResults, ...resultsWithCollection];
          totalCount += result.data.count || result.data.results.length;
        }
      }
      if (allResults.length > 0) {
        // Ordenar por data (mais recente primeiro)
        allResults.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

        // Carregar o primeiro resultado
        const firstResult = allResults[0];
        await handleResultSelect(firstResult, firstResult.searchCollection);

        // Passar todos os resultados para exibir na galeria
        onSearchComplete(handleSearch, isSearching, allResults, handleResultSelect);
        toast.success(`${totalCount} imagens encontradas`, {
          description: `${allResults.length} imagens de ${searchPromises.length} fonte(s)`
        });
      } else {
        onSearchComplete(handleSearch, isSearching, [], handleResultSelect);
        toast.warning("Nenhuma imagem encontrada", {
          description: hasError ? "Algumas buscas falharam. Tente outro período ou área" : "Tente outro período ou área"
        });
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Erro na busca", {
        description: error.message || "Tente novamente"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Expose search function to parent - atualizar sempre que currentAOI ou isSearching mudar
  useEffect(() => {
    onSearchComplete(handleSearch, isSearching, undefined, handleResultSelect);
  }, [currentAOI, isSearching]);
  const getActiveCollections = () => {
    const activeLayers = layers.filter(l => l.enabled);
    const collections: string[] = [];

    // Mapear camadas ativas para suas coleções correspondentes
    const layerToCollection: Record<string, string> = {
      'sentinel2': 'sentinel-2-l2a',
      'landsat': 'landsat-c2-l2',
      'dem': 'cop-dem-glo-30',
      'nasadem': 'nasadem',
      'alosdem': 'alos-dem',
      'modis-reflectance': 'modis-09Q1-061',
      'modis-vegetation': 'modis-13A1-061',
      'modis-biomass': 'modis-17A3HGF-061',
      'modis-temperature': 'modis-11A1-061',
      'global-biomass': 'hgb',
      'esa-worldcover': 'esa-worldcover'
    };

    // Adicionar coleções de todas as camadas ativas
    activeLayers.forEach(layer => {
      const collection = layerToCollection[layer.id];
      if (collection && !collections.includes(collection)) {
        collections.push(collection);
      }
    });

    // Adicionar Sentinel-2 como padrão APENAS quando nenhuma camada estiver ativa.
    // Se apenas SAR (Sentinel-1) estiver ativo, não adicionar coleções ópticas por padrão.
    if (collections.length === 0 && activeLayers.length === 0) {
      collections.push('sentinel-2-l2a');
    }
    return collections;
  };
  const getActiveCollection = () => {
    const collections = getActiveCollections();
    if (collections.length > 0) return collections[0];
    // Se não há coleções mapeadas e existe alguma camada Sentinel-1 ativa, priorizar Sentinel-1
    const hasSentinel1Active = layers.some(l => l.enabled && l.id.startsWith('sentinel1'));
    if (hasSentinel1Active) return 'sentinel-1-grd';
    // Fallback geral quando nenhuma camada está ativa
    return 'sentinel-2-l2a';
  };
  return <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Botões de controle - movidos para não conflitar com draw controls */}
      <div className="absolute bottom-20 left-4 z-10 flex gap-2">
        {currentAOI && <Button onClick={clearAllPolygons} variant="destructive" size="sm" className="shadow-elevated" title="Limpar Polígonos">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            <span className="ml-2">Limpar</span>
          </Button>}
        
        <Button onClick={toggle3DMode} variant={is3DMode ? "default" : "outline"} size="sm" className="shadow-elevated" title={is3DMode ? "Mudar para Modo 2D" : "Mudar para Modo 3D"}>
          {is3DMode ? <>
              <Box className="h-4 w-4" />
              <span className="ml-2">2D</span>
            </> : <>
              <Cuboid className="h-4 w-4" />
              <span className="ml-2">3D</span>
            </>}
        </Button>
      </div>
      
      {/* Overlay watermark */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground z-10">
        <span className="font-semibold">Belém</span> - Monitoramento Geoespacial
      </div>

      {/* Legend */}
      {layers.some(l => l.enabled) && <div className="absolute top-24 right-4 bg-card/95 backdrop-blur-sm p-4 rounded-lg border border-border shadow-elevated max-w-xs py-[20px] mx-0 my-[20px]">
          <h4 className="text-sm font-semibold mb-3 text-foreground">
            Camadas Ativas
          </h4>
          <div className="space-y-2">
            {layers.filter(l => l.enabled).map(layer => {
          const Icon = layer.icon;
          return <div key={layer.id} className="flex items-center gap-2">
                    <Icon className="h-3 w-3" style={{
              color: layer.color
            }} />
                    <span className="text-xs text-foreground">{layer.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {layer.opacity}%
                    </span>
                  </div>;
        })}
          </div>
        </div>}
    </div>;
};
export default MapView;