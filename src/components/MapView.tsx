import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layer } from "./LayerControl";
import Sentinel1Search from "./Sentinel1Search";
import PlanetarySearch from "./PlanetarySearch";
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

const MapView = ({ layers, onFeatureClick }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [currentImageResult, setCurrentImageResult] = useState<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [activeSearchType, setActiveSearchType] = useState<'sentinel1' | 'planetary'>('sentinel1');

  console.log("MapView render - mapLoaded:", mapLoaded);

  useEffect(() => {
    console.log("🚀 MapView useEffect - Initializing map", { 
      hasContainer: !!mapContainer.current, 
      hasMap: !!map.current 
    });
    
    if (!mapContainer.current || map.current) {
      console.log("⏭️ Skipping map initialization", {
        noContainer: !mapContainer.current,
        mapExists: !!map.current
      });
      return;
    }

    console.log("🗺️ Setting Mapbox token...");
    mapboxgl.accessToken = MAPBOX_TOKEN;
    console.log("✅ Token set, creating map instance...");

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-48.5044, -1.4558], // Belém coordinates
        zoom: 11,
        pitch: 0,
        antialias: true, // Melhor qualidade 3D
      });

      console.log("✅ Mapbox map instance created");
    } catch (error) {
      console.error("❌ Error creating map:", error);
      toast.error("Erro ao inicializar mapa");
      return;
    }


    console.log("🎮 Adding navigation controls...");

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "top-right"
    );

    console.log("📏 Adding scale control...");

    // Add scale control
    map.current.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: "metric",
      }),
      "bottom-right"
    );

    console.log("✏️ Adding drawing controls...");

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

    console.log("✅ All controls added");

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
      console.log("🎉 Mapbox map LOADED successfully!");
      setMapLoaded(true);
      toast.success("Mapa carregado!");
      
      // Add example polygon for Belém baixadas
      if (map.current) {
        console.log("➕ Adding example polygon...");
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
      console.log("🧹 Cleaning up map...");
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update layer visibility and opacity based on selected layers
  useEffect(() => {
    if (!mapLoaded || !map.current || !currentAOI || !currentImageResult) return;
    
    // Verificar se o mapa está totalmente carregado
    if (!map.current.isStyleLoaded()) {
      console.log("⏳ Waiting for map style to load before updating overlay");
      const handleStyleLoad = () => {
        if (map.current && currentImageResult && currentAOI) {
          const activeLayers = layers.filter(l => l.enabled);
          updateImageOverlay(currentImageResult, activeLayers);
        }
      };
      map.current.once('styledata', handleStyleLoad);
      return () => {
        if (map.current) {
          map.current.off('styledata', handleStyleLoad);
        }
      };
    }

    const activeLayers = layers.filter(l => l.enabled);
    console.log("Active layers:", activeLayers.map(l => l.name));
    
    // Update image based on active layers
    updateImageOverlay(currentImageResult, activeLayers);
  }, [layers, mapLoaded, currentAOI, currentImageResult]);

  const clearAllPolygons = () => {
    if (draw.current && map.current) {
      try {
        draw.current.deleteAll();
        setCurrentAOI(null);
        setCurrentImageResult(null);
        removeImageOverlay();
        toast.success("Todos os polígonos removidos");
      } catch (error) {
        console.error("Error clearing polygons:", error);
        toast.error("Erro ao limpar polígonos");
      }
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
    if (!map.current || !map.current.isStyleLoaded()) return;
    
    const mapInstance = map.current;
    
    // Remove all SAR/image overlays safely
    let layerIndex = 0;
    while (layerIndex < 20) { // Max 20 overlays
      const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
      const sourceId = `${layerId}-source`;
      
      let layerExists = false;
      let sourceExists = false;
      
      try {
        // Check if layer exists
        const layer = mapInstance.getLayer(layerId);
        layerExists = !!layer;
      } catch (e) {
        layerExists = false;
      }
      
      try {
        // Check if source exists
        const source = mapInstance.getSource(sourceId);
        sourceExists = !!source;
      } catch (e) {
        sourceExists = false;
      }
      
      if (!layerExists && !sourceExists) {
        break; // No more overlays to remove
      }
      
      // Remove layer if it exists
      if (layerExists) {
        try {
          mapInstance.removeLayer(layerId);
        } catch (e) {
          console.warn(`Failed to remove layer ${layerId}:`, e);
        }
      }
      
      // Remove source if it exists
      if (sourceExists) {
        try {
          mapInstance.removeSource(sourceId);
        } catch (e) {
          console.warn(`Failed to remove source ${sourceId}:`, e);
        }
      }
      
      layerIndex++;
    }
    
    console.log("🗑️ All image overlays removed");
  };

  const updateImageOverlay = async (result: any, activeLayers: Layer[], layerIndex: number = 0, collection?: string) => {
    console.log("🔄 updateImageOverlay called", { layerIndex, collection, hasResult: !!result, mapLoaded });
    
    if (!map.current || !result || !mapLoaded) {
      console.log("⚠️ Early return:", { hasMap: !!map.current, hasResult: !!result, mapLoaded });
      return;
    }
    
    const mapInstance = map.current;
    
    // Verificar se o mapa está pronto
    if (!mapInstance.isStyleLoaded()) {
      console.log("⏳ Map style not loaded yet, retrying in 500ms...");
      setTimeout(() => {
        updateImageOverlay(result, activeLayers, layerIndex, collection);
      }, 500);
      return;
    }
    
    console.log("✅ Map is ready, proceeding with overlay update");
    
    // Determine which image to load based on active layers
    const hasSentinel1VV = activeLayers.some(l => l.id === 'sentinel1-vv');
    const hasSentinel1VH = activeLayers.some(l => l.id === 'sentinel1-vh');
    const hasSentinel2 = activeLayers.some(l => l.id === 'sentinel2');
    const hasLandsat = activeLayers.some(l => l.id === 'landsat');
    const hasDEM = activeLayers.some(l => l.id === 'dem');
    const hasNASADEM = activeLayers.some(l => l.id === 'nasadem');
    const hasALOSDEM = activeLayers.some(l => l.id === 'alosdem');
    
    let imageUrl = null;
    let opacity = 0.75;
    
    // Priority: Sentinel-1 VV/VH composite, then individual polarizations
    if (hasSentinel1VV && hasSentinel1VH && (!collection || collection.includes('sentinel-1'))) {
      // Use false-color composite (VV, VH)
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = Math.max(
        activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
        activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
      ) / 100;
    } else if (hasSentinel1VV && (!collection || collection.includes('sentinel-1'))) {
      // Use VV polarization
      imageUrl = result.assets?.vv?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
    } else if (hasSentinel1VH && (!collection || collection.includes('sentinel-1'))) {
      // Use VH polarization
      imageUrl = result.assets?.vh?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
    } else if (hasSentinel2 && collection === 'sentinel-2-l2a') {
      // Sentinel-2 True Color
      imageUrl = result.assets?.visual?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel2')?.opacity || 80) / 100;
    } else if (hasLandsat && collection === 'landsat-c2-l2') {
      // Landsat True Color - usar asset correto
      imageUrl = result.assets?.rendered_preview?.href || 
                 result.assets?.visual?.href ||
                 `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=landsat-c2-l2&item=${result.id}&assets=red&assets=green&assets=blue&rescale=0,30000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'landsat')?.opacity || 80) / 100;
    } else if (hasDEM && collection === 'cop-dem-glo-30') {
      // DEM visualization with hillshade
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=cop-dem-glo-30&item=${result.id}&assets=data&colormap=terrain&rescale=-100,3000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'dem')?.opacity || 70) / 100;
    } else if (hasNASADEM && collection === 'nasadem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=nasadem&item=${result.id}&assets=elevation&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'nasadem')?.opacity || 70) / 100;
    } else if (hasALOSDEM && collection === 'alos-dem') {
      imageUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=alos-dem&item=${result.id}&assets=data&colormap=terrain&rescale=0,500&format=png`;
      opacity = (activeLayers.find(l => l.id === 'alosdem')?.opacity || 70) / 100;
    } else {
      // No relevant layers enabled, remove overlay
      return;
    }
    
    if (!imageUrl) {
      console.error("❌ No image URL available for result:", result.id);
      return;
    }

    console.log("🖼️ Image URL:", imageUrl);
    console.log("📊 Opacity:", opacity);
    console.log("📦 BBox:", result.bbox);

    const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
    const sourceId = `${layerId}-source`;
    
    console.log("🏷️ Layer/Source IDs:", { layerId, sourceId });
    
    try {
      // Wait for any pending style changes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Remove old overlay if exists - verificar de forma segura
      console.log("🧹 Checking for existing layer/source...");
      let layerExists = false;
      let sourceExists = false;
      
      try {
        const layer = mapInstance.getLayer(layerId);
        layerExists = layer !== undefined;
        console.log(`Layer ${layerId} exists:`, layerExists);
      } catch (e) {
        console.log(`Layer ${layerId} check error:`, e);
        layerExists = false;
      }
      
      try {
        const source = mapInstance.getSource(sourceId);
        sourceExists = source !== undefined;
        console.log(`Source ${sourceId} exists:`, sourceExists);
      } catch (e) {
        console.log(`Source ${sourceId} check error:`, e);
        sourceExists = false;
      }
      
      if (layerExists) {
        console.log(`🗑️ Removing layer: ${layerId}`);
        mapInstance.removeLayer(layerId);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (sourceExists) {
        console.log(`🗑️ Removing source: ${sourceId}`);
        mapInstance.removeSource(sourceId);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      if (!result.bbox || result.bbox.length !== 4) {
        console.error("❌ Invalid bbox:", result.bbox);
        return;
      }

      const [west, south, east, north] = result.bbox;
      console.log("🗺️ Coordinates:", { west, south, east, north });
      
      // Add image source
      console.log("➕ Adding image source...");
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
      
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add raster layer with dynamic opacity
      // Colocar acima do terreno 3D se existir
      let beforeLayerId;
      try {
        const layers = mapInstance.getStyle()?.layers || [];
        const firstSymbolLayer = layers.find(layer => layer && layer.type === 'symbol');
        beforeLayerId = firstSymbolLayer?.id;
        console.log("🎯 Inserting before layer:", beforeLayerId || "end");
      } catch (e) {
        console.log("⚠️ Could not find symbol layer:", e);
        beforeLayerId = undefined;
      }
      
      console.log("➕ Adding raster layer...");
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300,
          'raster-resampling': 'linear'
        }
      }, beforeLayerId);

      console.log(`✅ Image overlay ${layerIndex} added successfully! - opacity: ${opacity}`);
      toast.success("Imagem carregada", {
        description: `Layer: ${layerId}`
      });
      
    } catch (error) {
      console.error(`❌ Error updating image overlay ${layerIndex}:`, error);
      toast.error("Erro ao carregar imagem", {
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  };

  const handleResultSelect = async (result: any, collection?: string, isMultiple: boolean = false, index: number = 0) => {
    console.log("🎯 handleResultSelect called:", { 
      resultId: result.id, 
      collection, 
      isMultiple, 
      index,
      hasAssets: !!result.assets,
      bbox: result.bbox
    });

    if (!map.current || !mapLoaded) {
      console.log("⚠️ Map not ready");
      toast.error("Aguarde o mapa carregar");
      return;
    }
    
    // Verificar se o estilo do mapa está carregado
    if (!map.current.isStyleLoaded()) {
      console.log("⏳ Style not loaded, waiting...");
      toast.info("Aguardando mapa carregar...");
      map.current.once('styledata', () => {
        console.log("✅ Style loaded, retrying handleResultSelect");
        handleResultSelect(result, collection, isMultiple, index);
      });
      return;
    }
    
    console.log("✅ Map ready, processing result...");

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

  // Determine which search component to show based on active layers
  useEffect(() => {
    const activeLayers = layers.filter(l => l.enabled);
    const hasSentinel1 = activeLayers.some(l => l.id.startsWith('sentinel1'));
    const hasOther = activeLayers.some(l => ['sentinel2', 'landsat', 'dem', 'nasadem', 'alosdem'].includes(l.id));
    
    if (hasOther && !hasSentinel1) {
      setActiveSearchType('planetary');
    } else if (hasSentinel1) {
      setActiveSearchType('sentinel1');
    }
  }, [layers]);

  const getActiveCollection = () => {
    const activeLayers = layers.filter(l => l.enabled);
    if (activeLayers.some(l => l.id === 'sentinel2')) return 'sentinel-2-l2a';
    if (activeLayers.some(l => l.id === 'landsat')) return 'landsat-c2-l2';
    if (activeLayers.some(l => l.id === 'dem')) return 'cop-dem-glo-30';
    if (activeLayers.some(l => l.id === 'nasadem')) return 'nasadem';
    if (activeLayers.some(l => l.id === 'alosdem')) return 'alos-dem';
    return 'sentinel-2-l2a';
  };

  return (
    <div className="w-full h-full relative">
      <div 
        ref={mapContainer} 
        className="absolute inset-0"
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }} 
      />
      
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-foreground">Carregando mapa...</p>
          </div>
        </div>
      )}
      
      {activeSearchType === 'sentinel1' ? (
        <Sentinel1Search aoi={currentAOI} onResultSelect={handleResultSelect} />
      ) : (
        <PlanetarySearch 
          aoi={currentAOI} 
          activeCollection={getActiveCollection()}
          onResultSelect={handleResultSelect} 
        />
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
