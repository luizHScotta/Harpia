import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layer } from "./LayerControl";
import Sentinel1Search from "./Sentinel1Search";
import PlanetarySearch from "./PlanetarySearch";
import WaterAnalysis from "./WaterAnalysis";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Box, Cuboid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Mapbox token configured
const MAPBOX_TOKEN = "pk.eyJ1IjoiYW5kcmV3b2J4IiwiYSI6ImNtMWh2MXZ5eDBqNnQyeG9za2R1N2lwc2YifQ.7yCrlwa4nNFKpg2TcQoFQg";

interface MapViewProps {
  layers: Layer[];
  onFeatureClick: (data: any) => void;
}

interface SelectedArea {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface DateRange {
  start: string;
  end: string;
}

// Default AOI for Belém (large area covering the city)
const DEFAULT_BELEM_AOI = {
  type: "Polygon",
  coordinates: [[
    [-48.65, -1.55],  // NW
    [-48.30, -1.55],  // NE
    [-48.30, -1.25],  // SE
    [-48.65, -1.25],  // SW
    [-48.65, -1.55]   // Close polygon
  ]]
};

const MapView = ({ layers, onFeatureClick }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Track active layers with their Mapbox layer IDs
  const activeLayersRef = useRef<Map<string, { sourceId: string; layerId: string }>>(new Map());

  console.log("MapView render - mapLoaded:", mapLoaded);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-48.5044, -1.4558], // Belém coordinates
      zoom: 11,
      pitch: 0,
      antialias: true,
    });

    console.log("Mapbox map initialized");

    // Add navigation controls
    mapRef.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-right"
    );

    // Add scale control
    mapRef.current.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: "metric",
      }),
      "bottom-right"
    );

    // Add drawing controls
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: false
      },
      defaultMode: 'simple_select'
    });
    mapRef.current.addControl(draw.current, "top-left");

    // Listen to draw events
    mapRef.current.on('draw.create', updateArea);
    mapRef.current.on('draw.delete', updateArea);
    mapRef.current.on('draw.update', updateArea);

    function updateArea() {
      const data = draw.current?.getAll();
      if (data && data.features.length > 0) {
        if (data.features.length > 1) {
          const latestFeature = data.features[data.features.length - 1];
          data.features.slice(0, -1).forEach(feature => {
            draw.current?.delete(feature.id as string);
          });
          setCurrentAOI(latestFeature.geometry);
        } else {
          const polygon = data.features[0];
          setCurrentAOI(polygon.geometry);
        }
      } else {
        setCurrentAOI(null);
        setSelectedArea(null);
      }
    }

    mapRef.current.on("load", () => {
      console.log("Mapbox map loaded successfully");
      setMapLoaded(true);
      
      // Set default selected area to Belém
      setSelectedArea({
        west: -48.65,
        south: -1.55,
        east: -48.30,
        north: -1.25
      });
    });

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  // Update opacity for all active layers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    console.log("🎨 Opacity update triggered");
    
    // Update opacity for each active layer
    activeLayersRef.current.forEach((layerInfo, layerId) => {
      const layer = layers.find(l => l.id === layerId);
      if (layer && mapRef.current?.getLayer(layerInfo.layerId)) {
        const opacity = layer.opacity / 100;
        console.log(`🎨 Setting opacity for ${layerId} (${layerInfo.layerId}): ${opacity}`);
        mapRef.current.setPaintProperty(layerInfo.layerId, 'raster-opacity', opacity);
      }
    });
  }, [layers, mapLoaded]);

  const clearAllPolygons = () => {
    if (draw.current) {
      draw.current.deleteAll();
      setCurrentAOI(null);
      toast.success("Todos os polígonos removidos");
    }
  };

  const toggle3DMode = () => {
    if (!mapRef.current) return;
    
    const newMode = !is3DMode;
    setIs3DMode(newMode);
    
    if (newMode) {
      mapRef.current.easeTo({
        pitch: 70,
        bearing: -17.6,
        duration: 1500
      });

      if (!mapRef.current.getSource('mapbox-dem')) {
        mapRef.current.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
        });
        
        mapRef.current.setTerrain({ 
          'source': 'mapbox-dem', 
          'exaggeration': 2.5
        });

        mapRef.current.addLayer({
          'id': 'sky',
          'type': 'sky',
          'paint': {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 90.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      } else {
        mapRef.current.setTerrain({ 
          'source': 'mapbox-dem', 
          'exaggeration': 2.5 
        });
      }
      
      toast.success("Modo 3D ativado");
    } else {
      mapRef.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1500
      });
      
      mapRef.current.setTerrain(null);
      toast.success("Modo 2D ativado");
    }
  };

  const updateImageOverlay = useCallback(async (imageUrl: string, bbox: [number, number, number, number], layerId: string) => {
    if (!mapRef.current) return;

    try {
      const layer = layers.find(l => l.id === layerId);
      if (!layer || !layer.enabled) return;

      const opacity = (layer.opacity || 70) / 100;
      
      // Generate unique IDs for this layer
      const sourceId = `${layerId}-source`;
      const mapboxLayerId = `${layerId}-layer`;

      console.log(`🖼️ Adding layer: ${layerId} with source: ${sourceId}`);

      // Remove existing layer and source if they exist
      if (mapRef.current.getLayer(mapboxLayerId)) {
        mapRef.current.removeLayer(mapboxLayerId);
      }
      if (mapRef.current.getSource(sourceId)) {
        mapRef.current.removeSource(sourceId);
      }

      // Add new source
      mapRef.current.addSource(sourceId, {
        type: 'image',
        url: imageUrl,
        coordinates: [
          [bbox[0], bbox[3]], // top-left
          [bbox[2], bbox[3]], // top-right
          [bbox[2], bbox[1]], // bottom-right
          [bbox[0], bbox[1]]  // bottom-left
        ]
      });
      console.log("✅ Added image source:", sourceId);

      // Add layer
      mapRef.current.addLayer({
        id: mapboxLayerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300
        }
      });

      // Track this active layer
      activeLayersRef.current.set(layerId, { sourceId, layerId: mapboxLayerId });
      
      console.log(`✅ Layer ${layerId} added successfully - opacity: ${opacity}`);
    } catch (error) {
      console.error(`❌ Error adding layer ${layerId}:`, error);
    }
  }, [layers]);

  // Auto-load layer data when enabled
  useEffect(() => {
    if (!selectedArea || !mapLoaded) return;

    const autoLoadLayerData = async () => {
      const {
        west,
        south,
        east,
        north
      } = selectedArea;

      // Process each active layer independently
      for (const layer of layers) {
        if (!layer.enabled) {
          // Remove layer if it's not visible
          const layerInfo = activeLayersRef.current.get(layer.id);
          if (layerInfo && mapRef.current) {
            if (mapRef.current.getLayer(layerInfo.layerId)) {
              mapRef.current.removeLayer(layerInfo.layerId);
            }
            if (mapRef.current.getSource(layerInfo.sourceId)) {
              mapRef.current.removeSource(layerInfo.sourceId);
            }
            activeLayersRef.current.delete(layer.id);
            console.log(`🗑️ Removed layer: ${layer.id}`);
          }
          continue;
        }

        // Skip if layer is already loaded
        if (activeLayersRef.current.has(layer.id)) {
          console.log(`✅ Layer ${layer.id} already loaded`);
          continue;
        }

        // Determine collection and parameters for this layer
        let collection: string | null = null;
        let assets: string[] = [];
        let colorFormula = "";
        let rescale = "";
        let colormap = "";

        switch (layer.id) {
          case 'sentinel1-vv':
            collection = 'sentinel-1-grd';
            assets = ['vv'];
            colorFormula = 'gamma RGB 3.5, saturation 1.7, sigmoidal RGB 15 0.35';
            break;
          case 'sentinel1-vh':
            collection = 'sentinel-1-grd';
            assets = ['vh'];
            colorFormula = 'gamma RGB 3.5, saturation 1.7, sigmoidal RGB 15 0.35';
            break;
          case 'sentinel2':
            collection = 'sentinel-2-l2a';
            assets = ['B04', 'B03', 'B02'];
            colorFormula = 'gamma RGB 3.0, saturation 1.9, sigmoidal RGB 0 0.55';
            break;
          case 'landsat':
            collection = 'landsat-c2-l2';
            assets = ['SR_B4', 'SR_B3', 'SR_B2'];
            colorFormula = 'gamma RGB 3.0, saturation 1.9, sigmoidal RGB 0 0.55';
            break;
          case 'modis':
            collection = 'modis-09Q1-061';
            assets = ['sur_refl_b02', 'sur_refl_b01', 'sur_refl_b01'];
            colorFormula = 'gamma RGB 3.0, saturation 1.9, sigmoidal RGB 0 0.55';
            break;
          case 'dem-terrain':
            collection = 'cop-dem-glo-90';
            colormap = 'terrain';
            rescale = '0,1000';
            break;
          case 'esa-worldcover':
            collection = 'esa-worldcover';
            break;
          case 'io-lulc':
            collection = 'io-lulc';
            break;
          case 'ndwi':
          case 'sar-water':
          case 'ndvi':
          case 'ndmi':
          case 'false-color':
            // These are processed indices - skip for now
            continue;
        }

        if (!collection) continue;

        try {
          console.log(`🔄 Loading layer: ${layer.id} with collection: ${collection}`);
          toast.loading(`Carregando ${layer.name}...`, { id: `layer-${layer.id}` });

          const { data, error } = await supabase.functions.invoke('search-planetary-data', {
            body: {
              collection,
              bbox: [west, south, east, north],
              datetime: dateRange ? `${dateRange.start}/${dateRange.end}` : undefined,
              skipDateFilter: collection === 'cop-dem-glo-90'
            }
          });

          if (error) {
            console.error(`❌ API Error for ${layer.id}:`, error);
            toast.error(`Erro ao carregar ${layer.name}`, { 
              id: `layer-${layer.id}`,
              description: "A API está temporariamente indisponível. Tente novamente."
            });
            continue;
          }

          if (!data?.success) {
            console.warn(`⚠️ No success flag for ${layer.id}`);
            toast.warning(`Dados não encontrados para ${layer.name}`, { 
              id: `layer-${layer.id}`,
              description: "Tente ajustar a área ou período"
            });
            continue;
          }

          if (!data?.items?.[0]) {
            console.log(`⚠️ No data found for ${layer.id}`);
            toast.warning(`Sem dados disponíveis para ${layer.name}`, { 
              id: `layer-${layer.id}`,
              description: "Nenhuma imagem encontrada nesta área"
            });
            continue;
          }

          const item = data.items[0];
          const renderParams = new URLSearchParams({
            collection,
            item: item.id,
            tile_format: 'png',
            format: 'png'
          });

          if (assets.length > 0) {
            assets.forEach(asset => renderParams.append('assets', asset));
          }
          if (colorFormula) {
            renderParams.set('color_formula', colorFormula);
          }
          if (rescale) {
            renderParams.set('rescale', rescale);
          }
          if (colormap) {
            renderParams.set('colormap_name', colormap);
          }

          const imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?${renderParams.toString()}`;
          console.log(`✅ Loading image for ${layer.id}:`, imageUrl);

          await updateImageOverlay(imageUrl, [west, south, east, north], layer.id);
          
          toast.success(`${layer.name} carregada com sucesso`, { id: `layer-${layer.id}` });
        } catch (err: any) {
          console.error(`❌ Error loading ${layer.id}:`, err);
          toast.error(`Falha ao carregar ${layer.name}`, { 
            id: `layer-${layer.id}`,
            description: err.message || "Erro desconhecido"
          });
        }
      }
    };

    autoLoadLayerData();
  }, [selectedArea, layers, mapLoaded, dateRange, updateImageOverlay]);

  const handleResultSelect = (result: any) => {
    console.log("Selected result:", result);
    toast.success("Imagem selecionada", {
      description: `Carregando dados de ${result.datetime}`
    });
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* 3D Toggle Button */}
      <div className="absolute top-4 left-16 z-10">
        <Button
          variant={is3DMode ? "default" : "outline"}
          size="sm"
          onClick={toggle3DMode}
          className="shadow-lg"
        >
          {is3DMode ? <Cuboid className="h-4 w-4 mr-2" /> : <Box className="h-4 w-4 mr-2" />}
          {is3DMode ? "Modo 3D" : "Modo 2D"}
        </Button>
      </div>

      {/* Clear Polygons Button */}
      {currentAOI && (
        <div className="absolute top-4 left-40 z-10">
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAllPolygons}
            className="shadow-lg"
          >
            Limpar Polígonos
          </Button>
        </div>
      )}

      {/* SAR Search Panel */}
      <div className="absolute bottom-6 left-6 z-10 w-96">
        <Sentinel1Search 
          aoi={currentAOI || DEFAULT_BELEM_AOI}
          onResultSelect={handleResultSelect}
        />
      </div>

      {/* Planetary Search Panel */}
      <div className="absolute bottom-6 right-6 z-10 w-96">
        <PlanetarySearch
          aoi={currentAOI || DEFAULT_BELEM_AOI}
          activeCollection="sentinel-2-l2a"
          onResultSelect={handleResultSelect}
        />
      </div>

      {/* Water Analysis Panel */}
      <div className="absolute top-20 right-6 z-10 w-80">
        <WaterAnalysis 
          aoi={currentAOI} 
          onResultSelect={handleResultSelect}
        />
      </div>
    </div>
  );
};

export default MapView;
