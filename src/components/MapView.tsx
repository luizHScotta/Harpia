import { useEffect, useRef, useState } from "react";
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

// Mapbox token configured
const MAPBOX_TOKEN = "pk.eyJ1IjoiYW5kcmV3b2J4IiwiYSI6ImNtMWh2MXZ5eDBqNnQyeG9za2R1N2lwc2YifQ.7yCrlwa4nNFKpg2TcQoFQg";

interface MapViewProps {
  layers: Layer[];
  onFeatureClick: (data: any) => void;
}

interface SatelliteLayer {
  id: string;
  type: 'sentinel1' | 'sentinel2';
  url: string;
  bbox: number[];
  opacity?: number;
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
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [currentImageResult, setCurrentImageResult] = useState<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [activeSearchType, setActiveSearchType] = useState<'sentinel1' | 'planetary'>('sentinel1');
  const [autoLoadingLayer, setAutoLoadingLayer] = useState<string | null>(null);

  console.log("MapView render - mapLoaded:", mapLoaded);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-48.5044, -1.4558], // Belém coordinates
      zoom: 11,
      pitch: 0,
      antialias: true, // Melhor qualidade 3D
    });

    console.log("Mapbox map initialized");

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-right"
    );

    // Add scale control
    map.current.addControl(
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
        trash: false // Desabilitar botão trash padrão, vamos criar o nosso
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
        // Manter apenas o polígono mais recente
        if (data.features.length > 1) {
          const latestFeature = data.features[data.features.length - 1];
          // Deletar todos os polígonos anteriores
          data.features.slice(0, -1).forEach(feature => {
            draw.current?.delete(feature.id as string);
          });
          setCurrentAOI(latestFeature.geometry);
          console.log("AOI updated (latest only):", latestFeature.geometry);
        } else {
          const polygon = data.features[0];
          setCurrentAOI(polygon.geometry);
          console.log("AOI updated:", polygon.geometry);
        }
      } else {
        setCurrentAOI(null);
        // Remove image overlay when polygon is deleted
        removeImageOverlay();
      }
    }

    map.current.on("load", () => {
      console.log("Mapbox map loaded successfully");
      setMapLoaded(true);
      
      // Add example polygon for Belém baixadas
      if (map.current) {
        // Example: Área da Cidade de Deus / Fazendinha
        map.current.addSource("belem-areas", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {
                  name: "Região da Baixada - Fazendinha",
                  population: 45000,
                  floodRisk: "Alto",
                  avgNDVI: 0.35,
                  avgLST: 32.5,
                  sanitation: 45,
                },
                geometry: {
                  type: "Polygon",
                  coordinates: [
                    [
                      [-48.52, -1.47],
                      [-48.49, -1.47],
                      [-48.49, -1.44],
                      [-48.52, -1.44],
                      [-48.52, -1.47],
                    ],
                  ],
                },
              },
            ],
          },
        });

        map.current.addLayer({
          id: "belem-areas-fill",
          type: "fill",
          source: "belem-areas",
          paint: {
            "fill-color": "hsl(165 65% 45%)",
            "fill-opacity": 0.2,
          },
        });

        map.current.addLayer({
          id: "belem-areas-outline",
          type: "line",
          source: "belem-areas",
          paint: {
            "line-color": "hsl(165 65% 45%)",
            "line-width": 2,
          },
        });

        // Click handler
        map.current.on("click", "belem-areas-fill", (e) => {
          if (e.features && e.features[0]) {
            onFeatureClick(e.features[0].properties);
          }
        });

        // Change cursor on hover
        map.current.on("mouseenter", "belem-areas-fill", () => {
          if (map.current) map.current.getCanvas().style.cursor = "pointer";
        });

        map.current.on("mouseleave", "belem-areas-fill", () => {
          if (map.current) map.current.getCanvas().style.cursor = "";
        });
      }
    });

    return () => {
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

  // Store mapping of map layers to control layers for opacity updates
  const layerMappingRef = useRef<Map<string, string>>(new Map());
  
  // Update opacity of all existing raster layers dynamically
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Update each layer's opacity individually
    layers.forEach(layer => {
      if (!layer.enabled) return;
      
      // Try to find matching map layer by checking the mapping or searching all layers
      const mapLayerIds = ['sar-overlay', 'sar-overlay-1', 'sar-overlay-2', 'sar-overlay-3'];
      
      mapLayerIds.forEach(mapLayerId => {
        // Check if this map layer is mapped to this control layer
        const mappedControlLayerId = layerMappingRef.current.get(mapLayerId);
        
        if (mappedControlLayerId === layer.id && map.current?.getLayer(mapLayerId)) {
          const opacity = layer.opacity / 100;
          map.current.setPaintProperty(mapLayerId, 'raster-opacity', opacity);
          console.log(`🎨 Updated opacity for ${mapLayerId} (${layer.id}): ${opacity}`);
        }
      });
    });
  }, [layers.map(l => `${l.id}:${l.opacity}:${l.enabled}`).join(','), mapLoaded]);

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
    if (!map.current) return;
    
    const newMode = !is3DMode;
    setIs3DMode(newMode);
    
    if (newMode) {
      // Ativar 3D com terreno
      map.current.easeTo({
        pitch: 70,
        bearing: -17.6,
        duration: 1500
      });

      // Adicionar fonte de terreno DEM se não existir
      if (!map.current.getSource('mapbox-dem')) {
        map.current.addSource('mapbox-dem', {
          'type': 'raster-dem',
          'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
          'tileSize': 512,
          'maxzoom': 14
        });
        
        // Configurar terreno 3D
        map.current.setTerrain({ 
          'source': 'mapbox-dem', 
          'exaggeration': 2.5 // Exagerar relevo para melhor visualização
        });

        // Adicionar sky layer para efeito atmosférico
        map.current.addLayer({
          'id': 'sky',
          'type': 'sky',
          'paint': {
            'sky-type': 'atmosphere',
            'sky-atmosphere-sun': [0.0, 90.0],
            'sky-atmosphere-sun-intensity': 15
          }
        });
      } else {
        map.current.setTerrain({ 
          'source': 'mapbox-dem', 
          'exaggeration': 2.5 
        });
      }
      
      toast.success("Modo 3D ativado", {
        description: "Terreno com elevação real"
      });
    } else {
      // Voltar para 2D
      map.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 1500
      });
      
      // Remover terreno 3D
      map.current.setTerrain(null);
      
      toast.success("Modo 2D ativado");
    }
  };

  const removeImageOverlay = () => {
    if (!map.current) return;
    
    const mapInstance = map.current;
    
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
    
    console.log("🗑️ All image overlays removed");
  };

  const updateImageOverlay = async (result: any, activeLayers: Layer[], layerIndex: number = 0, collection?: string) => {
    if (!map.current || !result) return;
    
    const mapInstance = map.current;
    
    // Determine which image to load based on active layers
    const hasSentinel1VV = activeLayers.some(l => l.id === 'sentinel1-vv');
    const hasSentinel1VH = activeLayers.some(l => l.id === 'sentinel1-vh');
    const hasSentinel2 = activeLayers.some(l => l.id === 'sentinel2');
    const hasLandsat = activeLayers.some(l => l.id === 'landsat');
    const hasDEM = activeLayers.some(l => l.id === 'dem');
    const hasNASADEM = activeLayers.some(l => l.id === 'nasadem');
    const hasALOSDEM = activeLayers.some(l => l.id === 'alosdem');
    const hasMODISReflectance = activeLayers.some(l => l.id === 'modis-reflectance');
    const hasMODISVegetation = activeLayers.some(l => l.id === 'modis-vegetation');
    const hasMODISBiomass = activeLayers.some(l => l.id === 'modis-biomass');
    const hasMODISTemperature = activeLayers.some(l => l.id === 'modis-temperature');
    const hasGlobalBiomass = activeLayers.some(l => l.id === 'global-biomass');
    const hasESAWorldCover = activeLayers.some(l => l.id === 'esa-worldcover');
    const hasIOLULC = activeLayers.some(l => l.id === 'io-lulc');
    
    // New analysis layers
    const hasNDWI = activeLayers.some(l => l.id === 'ndwi-water');
    const hasSARWater = activeLayers.some(l => l.id === 'sar-backscatter');
    const hasNDVI = activeLayers.some(l => l.id === 'ndvi-vegetation');
    const hasNDMI = activeLayers.some(l => l.id === 'ndmi-moisture');
    const hasFalseColor = activeLayers.some(l => l.id === 'false-color-ir');
    const hasWaterMask = activeLayers.some(l => l.id === 'water-mask-blue');
    const hasVegetationMask = activeLayers.some(l => l.id === 'vegetation-mask-green');
    const hasSARFalseColor = activeLayers.some(l => l.id === 'sar-false-color');
    const hasDEMTerrain = activeLayers.some(l => l.id === 'dem-terrain');
    
    let imageUrl = null;
    let opacity = 0.75;
    
    console.log("🔍 updateImageOverlay - result:", result);
    console.log("🔍 Active layers:", { 
      hasSentinel1VV, hasSentinel1VH, hasSentinel2, hasLandsat, hasDEM,
      hasNDWI, hasSARWater, hasNDVI, hasNDMI, hasFalseColor 
    });
    
    // Priority: Check for processed index tiles first
    if (result.tileUrl && result.indexType) {
      // This is a processed index result from process-water-index
      // It's a tile URL template, need to use raster layer instead of image
      const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
      const sourceId = `${layerId}-source`;
      
      // Determine which layer is active and use its opacity
      let targetLayerId = '';
      if (hasNDWI && result.indexType === 'ndwi') {
        opacity = (activeLayers.find(l => l.id === 'ndwi-water')?.opacity || 70) / 100;
        targetLayerId = 'ndwi-water';
        console.log("✅ Using NDWI index tile layer");
      } else if (hasSARWater && result.indexType === 'sar-water') {
        opacity = (activeLayers.find(l => l.id === 'sar-backscatter')?.opacity || 70) / 100;
        targetLayerId = 'sar-backscatter';
        console.log("✅ Using SAR Water index tile layer");
      } else if (hasNDVI && result.indexType === 'ndvi') {
        opacity = (activeLayers.find(l => l.id === 'ndvi-vegetation')?.opacity || 70) / 100;
        targetLayerId = 'ndvi-vegetation';
        console.log("✅ Using NDVI index tile layer");
      } else if (hasNDMI && result.indexType === 'ndmi') {
        opacity = (activeLayers.find(l => l.id === 'ndmi-moisture')?.opacity || 70) / 100;
        targetLayerId = 'ndmi-moisture';
        console.log("✅ Using NDMI index tile layer");
      } else if (hasFalseColor && result.indexType === 'false-color') {
        opacity = (activeLayers.find(l => l.id === 'false-color-ir')?.opacity || 80) / 100;
        targetLayerId = 'false-color-ir';
        console.log("✅ Using False Color IR tile layer");
      } else if (hasWaterMask && result.indexType === 'water-mask') {
        opacity = (activeLayers.find(l => l.id === 'water-mask-blue')?.opacity || 80) / 100;
        targetLayerId = 'water-mask-blue';
        console.log("✅ Using Water Mask tile layer");
      } else if (hasVegetationMask && result.indexType === 'vegetation-mask') {
        opacity = (activeLayers.find(l => l.id === 'vegetation-mask-green')?.opacity || 80) / 100;
        targetLayerId = 'vegetation-mask-green';
        console.log("✅ Using Vegetation Mask tile layer");
      } else if (hasSARFalseColor && result.indexType === 'sar-false-color') {
        opacity = (activeLayers.find(l => l.id === 'sar-false-color')?.opacity || 80) / 100;
        targetLayerId = 'sar-false-color';
        console.log("✅ Using SAR False Color tile layer");
      }

      try {
        // Remove old overlay if exists
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId);
          console.log(`🗑️ Removed old tile layer: ${layerId}`);
        }
        if (mapInstance.getSource(sourceId)) {
          mapInstance.removeSource(sourceId);
          console.log(`🗑️ Removed old tile source: ${sourceId}`);
        }

        // Add raster tile source (not image!)
        mapInstance.addSource(sourceId, {
          type: 'raster',
          tiles: [result.tileUrl],
          tileSize: 256,
          maxzoom: 18
        });
        console.log(`✅ Added raster tile source: ${sourceId}`);

        // Add raster layer
        mapInstance.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': opacity,
            'raster-fade-duration': 0
          }
        });
        console.log(`✅ Raster tile layer ${layerId} added successfully with opacity: ${opacity}`);
        
        // Store mapping for opacity updates
        if (targetLayerId) {
          layerMappingRef.current.set(layerId, targetLayerId);
        }

        // Fit map to bounds
        const [west, south, east, north] = result.bbox;
        mapInstance.fitBounds([[west, south], [east, north]], {
          padding: 50,
          duration: 1000
        });

        return; // Exit early, we've handled the tile rendering
      } catch (error) {
        console.error(`❌ Error adding raster tile layer: ${layerId}`, error);
        toast.error("Erro ao carregar camada");
        return;
      }
    }
    
    // Check collection type and apply appropriate rendering
    // Priority: Sentinel-1 VV/VH composite, then individual polarizations
    // Only process Sentinel-1 if the result collection matches
    if (collection === 'sentinel-1-grd' || collection === 'sentinel-1-rtc') {
      if (hasSentinel1VV && hasSentinel1VH) {
        imageUrl = result.assets?.rendered_preview?.href;
        opacity = Math.max(
          activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
          activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
        ) / 100;
        console.log("✅ Using VV+VH composite:", imageUrl, "opacity:", opacity);
      } else if (hasSentinel1VV) {
        imageUrl = result.assets?.rendered_preview?.href;
        opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
        console.log("✅ Using VV polarization:", imageUrl, "opacity:", opacity);
      } else if (hasSentinel1VH) {
        imageUrl = result.assets?.rendered_preview?.href;
        opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
        console.log("✅ Using VH polarization:", imageUrl, "opacity:", opacity);
      }
    } else if (hasSentinel2 && collection === 'sentinel-2-l2a') {
      // Sentinel-2 True Color
      imageUrl = result.assets?.visual?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel2')?.opacity || 80) / 100;
      console.log("✅ Using Sentinel-2:", imageUrl);
    } else if (hasLandsat && collection === 'landsat-c2-l2') {
      // Landsat True Color - usar asset correto
      imageUrl = result.assets?.rendered_preview?.href || 
                 result.assets?.visual?.href ||
                 `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=landsat-c2-l2&item=${result.id}&assets=red&assets=green&assets=blue&rescale=0,30000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'landsat')?.opacity || 80) / 100;
      console.log("✅ Using Landsat:", imageUrl);
    } else if (hasDEM && collection === 'cop-dem-glo-30') {
      // DEM visualization with hillshade
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=cop-dem-glo-30&item=${result.id}&assets=data&colormap=terrain&rescale=-100,3000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'dem')?.opacity || 70) / 100;
      console.log("✅ Using DEM:", imageUrl);
    } else if (hasNASADEM && collection === 'nasadem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=nasadem&item=${result.id}&assets=elevation&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'nasadem')?.opacity || 70) / 100;
      console.log("✅ Using NASA DEM:", imageUrl);
    } else if (hasALOSDEM && collection === 'alos-dem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=alos-dem&item=${result.id}&assets=data&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'alosdem')?.opacity || 70) / 100;
      console.log("✅ Using ALOS DEM:", imageUrl);
    } else if (hasMODISReflectance && collection === 'modis-09Q1-061') {
      imageUrl = result.assets?.rendered_preview?.href || 
                 `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-09Q1-061&item=${result.id}&assets=sur_refl_b01&assets=sur_refl_b02&colormap=viridis&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-reflectance')?.opacity || 80) / 100;
      console.log("✅ Using MODIS Reflectance:", imageUrl);
    } else if (hasMODISVegetation && collection === 'modis-13A1-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-13A1-061&item=${result.id}&assets=500m_16_days_NDVI&colormap=greens&rescale=0,10000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-vegetation')?.opacity || 75) / 100;
      console.log("✅ Using MODIS Vegetation:", imageUrl);
    } else if (hasMODISBiomass && collection === 'modis-17A3HGF-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-17A3HGF-061&item=${result.id}&assets=Npp&colormap=greens&rescale=0,5000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-biomass')?.opacity || 70) / 100;
      console.log("✅ Using MODIS Biomass:", imageUrl);
    } else if (hasMODISTemperature && collection === 'modis-11A1-061') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=modis-11A1-061&item=${result.id}&assets=LST_Day_1km&colormap=thermal&rescale=13000,16000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'modis-temperature')?.opacity || 65) / 100;
      console.log("✅ Using MODIS Temperature:", imageUrl);
    } else if (hasGlobalBiomass && collection === 'hgb') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=hgb&item=${result.id}&assets=aboveground_biomass&colormap=viridis&rescale=0,300&format=png`;
      opacity = (activeLayers.find(l => l.id === 'global-biomass')?.opacity || 70) / 100;
      console.log("✅ Using Global Biomass:", imageUrl);
    } else if (hasESAWorldCover && collection === 'esa-worldcover') {
      imageUrl = result.assets?.map?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'esa-worldcover')?.opacity || 75) / 100;
      console.log("✅ Using ESA WorldCover:", imageUrl);
    } else if (hasIOLULC && collection === 'io-lulc') {
      // Impact Observatory Land Cover
      imageUrl = result.assets?.data?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'io-lulc')?.opacity || 75) / 100;
      console.log("✅ Using IO Land Cover:", imageUrl);
    } else if (hasDEMTerrain && collection === 'cop-dem-glo-90') {
      // Copernicus DEM with hillshade visualization
      const itemId = result.id;
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=cop-dem-glo-90&item=${itemId}&assets=data&colormap_name=terrain&rescale=0,1000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'dem-terrain')?.opacity || 70) / 100;
      console.log("✅ Using Copernicus DEM:", imageUrl);
    } else {
      console.log("⚠️ No relevant layers enabled");
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
      console.log("📦 BBox:", { west, south, east, north });
      
      // Add image source
      mapInstance.addSource(sourceId, {
        type: 'image',
        url: imageUrl,
        coordinates: [
          [west, north],
          [east, north],
          [east, south],
          [west, south]
        ]
      });
      console.log(`✅ Added image source: ${sourceId}`);

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

      console.log(`✅ Image overlay ${layerIndex} added successfully - opacity: ${opacity}`);
      
      // Store mapping for opacity updates - determine which control layer this is
      let controlLayerId = '';
      if (hasSentinel1VV) controlLayerId = 'sentinel1-vv';
      else if (hasSentinel1VH) controlLayerId = 'sentinel1-vh';
      else if (hasSentinel2) controlLayerId = 'sentinel2';
      else if (hasLandsat) controlLayerId = 'landsat';
      else if (hasDEM) controlLayerId = 'dem';
      else if (hasNASADEM) controlLayerId = 'nasadem';
      else if (hasALOSDEM) controlLayerId = 'alosdem';
      else if (hasMODISReflectance) controlLayerId = 'modis-reflectance';
      else if (hasMODISVegetation) controlLayerId = 'modis-vegetation';
      else if (hasMODISBiomass) controlLayerId = 'modis-biomass';
      else if (hasMODISTemperature) controlLayerId = 'modis-temperature';
      else if (hasGlobalBiomass) controlLayerId = 'global-biomass';
      else if (hasESAWorldCover) controlLayerId = 'esa-worldcover';
      else if (hasIOLULC) controlLayerId = 'io-lulc';
      else if (hasDEMTerrain) controlLayerId = 'dem-terrain';
      
      if (controlLayerId) {
        layerMappingRef.current.set(layerId, controlLayerId);
      }
      
      toast.success("Imagem sobreposta ao mapa", {
        description: `Opacidade: ${Math.round(opacity * 100)}%`
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
        // Fit map to image bounds only for single images
        const [west, south, east, north] = result.bbox;
        map.current.fitBounds([[west, south], [east, north]], {
          padding: 50,
          duration: 1000
        });

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

  // Determine suggested search type based on active layers (user can override)
  useEffect(() => {
    const activeLayers = layers.filter(l => l.enabled);
    const hasSentinel1 = activeLayers.some(l => l.id.startsWith('sentinel1'));
    const hasOther = activeLayers.some(l => 
      ['sentinel2', 'landsat', 'dem', 'nasadem', 'alosdem', 
       'modis-reflectance', 'modis-vegetation', 'modis-biomass', 
       'modis-temperature', 'global-biomass', 'esa-worldcover', 'io-lulc'].includes(l.id)
    );
    
    // Auto-suggest but don't force change
    if (hasOther && !hasSentinel1 && activeSearchType === 'sentinel1') {
      setActiveSearchType('planetary');
    } else if (hasSentinel1 && !hasOther && activeSearchType === 'planetary') {
      setActiveSearchType('sentinel1');
    }
  }, [layers]);

  // Auto-load data when analysis layers are toggled ON
  useEffect(() => {
    if (!mapLoaded) return;

    const activeLayers = layers.filter(l => l.enabled);
    
    // Map layer IDs to their respective collections and index types
    const analysisLayerMap: Record<string, { collection: string; indexType?: string }> = {
      'ndwi-water': { collection: 'sentinel-2-l2a', indexType: 'ndwi' },
      'water-mask-blue': { collection: 'sentinel-2-l2a', indexType: 'water-mask' },
      'vegetation-mask-green': { collection: 'sentinel-2-l2a', indexType: 'vegetation-mask' },
      'sar-backscatter': { collection: 'sentinel-1-grd', indexType: 'sar-water' },
      'sar-false-color': { collection: 'sentinel-1-rtc', indexType: 'sar-false-color' },
      'ndvi-vegetation': { collection: 'sentinel-2-l2a', indexType: 'ndvi' },
      'ndmi-moisture': { collection: 'sentinel-2-l2a', indexType: 'ndmi' },
      'false-color-ir': { collection: 'sentinel-2-l2a', indexType: 'false-color' },
      'modis-reflectance': { collection: 'modis-09Q1-061' },
      'modis-vegetation': { collection: 'modis-13A1-061' },
      'modis-biomass': { collection: 'modis-17A3HGF-061' },
      'modis-temperature': { collection: 'modis-11A1-061' },
      'global-biomass': { collection: 'hgb' },
      'esa-worldcover': { collection: 'esa-worldcover' },
      'io-lulc': { collection: 'io-lulc' },
      'dem-terrain': { collection: 'cop-dem-glo-90' }
    };

    // Find newly enabled analysis layer
    const newAnalysisLayer = activeLayers.find(l => 
      analysisLayerMap[l.id] && l.id !== autoLoadingLayer
    );

    if (newAnalysisLayer) {
      setAutoLoadingLayer(newAnalysisLayer.id);
      autoLoadLayerData(newAnalysisLayer.id, analysisLayerMap[newAnalysisLayer.id]);
    }
  }, [layers, mapLoaded]);

  const autoLoadLayerData = async (layerId: string, config: { collection: string; indexType?: string }) => {
    try {
      toast.info(`🔄 Carregando dados: ${layerId}`, {
        description: 'Buscando imagens mais recentes...'
      });

      const { supabase } = await import("@/integrations/supabase/client");
      const endDate = new Date().toISOString().split('T')[0];
      
      // MODIS products need longer time windows (composites every 8-16 days)
      // Copernicus DEM doesn't use temporal queries
      const daysBack = config.collection.startsWith('modis') ? 180 : 90;
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (config.indexType) {
        // Use process-water-index for spectral indices
        const { data, error } = await supabase.functions.invoke('process-water-index', {
          body: {
            aoi: DEFAULT_BELEM_AOI,
            startDate,
            endDate,
            collection: config.collection,
            indexType: config.indexType,
            threshold: config.indexType === 'sar-water' ? -17 : 0.2
          }
        });

        if (error) throw error;

        if (data?.success && data.results.length > 0) {
          // Load the most recent result
          handleResultSelect(data.results[0]);
          toast.success(`✅ ${layerId} carregado`, {
            description: `${data.count} cena(s) disponível(is)`
          });
        } else {
          toast.warning('Nenhum dado encontrado');
        }
      } else if (config.collection === 'cop-dem-glo-90') {
        // Copernicus DEM is a static product - search without date range
        const { data, error } = await supabase.functions.invoke('search-planetary-data', {
          body: {
            aoi: DEFAULT_BELEM_AOI,
            collection: config.collection,
            maxResults: 1,
            skipDateFilter: true // Special flag for static collections
          }
        });

        if (error) throw error;

        if (data?.success && data.results.length > 0) {
          handleResultSelect(data.results[0], config.collection);
          toast.success(`✅ ${layerId} carregado`, {
            description: 'Modelo digital de elevação'
          });
        } else {
          toast.warning('Nenhum dado DEM encontrado');
        }
      } else {
        // Use regular search for non-index layers
        const { data, error } = await supabase.functions.invoke('search-planetary-data', {
          body: {
            aoi: DEFAULT_BELEM_AOI,
            startDate,
            endDate,
            collection: config.collection,
            maxResults: 5
          }
        });

        if (error) throw error;

        if (data?.success && data.results.length > 0) {
          handleResultSelect(data.results[0], config.collection);
          toast.success(`✅ ${layerId} carregado`, {
            description: `${data.count} cena(s) encontrada(s)`
          });
        } else {
          toast.warning('Nenhum dado encontrado');
        }
      }
    } catch (error: any) {
      console.error('Erro ao auto-carregar camada:', error);
      toast.error(`Erro ao carregar ${layerId}`, {
        description: error.message
      });
    }
  };


  const getActiveCollection = () => {
    const activeLayers = layers.filter(l => l.enabled);
    if (activeLayers.some(l => l.id === 'sentinel2')) return 'sentinel-2-l2a';
    if (activeLayers.some(l => l.id === 'landsat')) return 'landsat-c2-l2';
    if (activeLayers.some(l => l.id === 'dem')) return 'cop-dem-glo-30';
    if (activeLayers.some(l => l.id === 'nasadem')) return 'nasadem';
    if (activeLayers.some(l => l.id === 'alosdem')) return 'alos-dem';
    if (activeLayers.some(l => l.id === 'modis-reflectance')) return 'modis-09Q1-061';
    if (activeLayers.some(l => l.id === 'modis-vegetation')) return 'modis-13A1-061';
    if (activeLayers.some(l => l.id === 'modis-biomass')) return 'modis-17A3HGF-061';
    if (activeLayers.some(l => l.id === 'modis-temperature')) return 'modis-11A1-061';
    if (activeLayers.some(l => l.id === 'global-biomass')) return 'hgb';
    if (activeLayers.some(l => l.id === 'esa-worldcover')) return 'esa-worldcover';
    return 'sentinel-2-l2a';
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Seletor de tipo de busca */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <Button
          onClick={() => setActiveSearchType('sentinel1')}
          variant={activeSearchType === 'sentinel1' ? 'default' : 'outline'}
          size="sm"
          className="shadow-elevated"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          Sentinel-1
        </Button>
        <Button
          onClick={() => setActiveSearchType('planetary')}
          variant={activeSearchType === 'planetary' ? 'default' : 'outline'}
          size="sm"
          className="shadow-elevated"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            <path d="M2 12h20" />
          </svg>
          Outros Satélites
        </Button>
      </div>
      
      {activeSearchType === 'sentinel1' ? (
        <Sentinel1Search aoi={currentAOI} onResultSelect={handleResultSelect} />
      ) : (
        <PlanetarySearch 
          aoi={currentAOI} 
          activeCollection={getActiveCollection()}
          onResultSelect={handleResultSelect} 
        />
      )}

      {/* Water Analysis Component - Only show when AOI is manually drawn */}
      {currentAOI && !autoLoadingLayer && (
        <WaterAnalysis aoi={currentAOI} onResultSelect={handleResultSelect} />
      )}
      {/* Botões de controle */}
      <div className="absolute top-20 left-4 z-10 space-y-2">
        {currentAOI && (
          <Button
            onClick={clearAllPolygons}
            variant="destructive"
            size="sm"
            className="shadow-elevated w-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Limpar Polígonos
          </Button>
        )}
        
        <Button
          onClick={toggle3DMode}
          variant={is3DMode ? "default" : "outline"}
          size="sm"
          className="shadow-elevated w-full"
        >
          {is3DMode ? (
            <>
              <Box className="mr-2 h-4 w-4" />
              Modo 2D
            </>
          ) : (
            <>
              <Cuboid className="mr-2 h-4 w-4" />
              Modo 3D
            </>
          )}
        </Button>
      </div>
      
      {/* Overlay watermark */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground z-10">
        <span className="font-semibold">Belém</span> - Monitoramento Geoespacial
      </div>

      {/* Legend */}
      {layers.some(l => l.enabled) && (
        <div className="absolute top-4 right-4 bg-card/95 backdrop-blur-sm p-4 rounded-lg border border-border shadow-elevated max-w-xs">
          <h4 className="text-sm font-semibold mb-3 text-foreground">
            Camadas Ativas
          </h4>
          <div className="space-y-2">
            {layers
              .filter(l => l.enabled)
              .map(layer => {
                const Icon = layer.icon;
                return (
                  <div key={layer.id} className="flex items-center gap-2">
                    <Icon className="h-3 w-3" style={{ color: layer.color }} />
                    <span className="text-xs text-foreground">{layer.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {layer.opacity}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
