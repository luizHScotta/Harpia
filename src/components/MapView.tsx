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
    
    let imageUrl = null;
    let opacity = 0.75;
    
    console.log("🔍 updateImageOverlay - result:", result);
    console.log("🔍 Active layers:", { hasSentinel1VV, hasSentinel1VH, hasSentinel2, hasLandsat, hasDEM });
    
    // Priority: Sentinel-1 VV/VH composite, then individual polarizations
    if (hasSentinel1VV && hasSentinel1VH) {
      // Use rendered_preview which has proper SAS token
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = Math.max(
        activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
        activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
      ) / 100;
      console.log("✅ Using VV+VH composite:", imageUrl);
    } else if (hasSentinel1VV) {
      // Use rendered_preview which has proper SAS token
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
      console.log("✅ Using VV polarization:", imageUrl);
    } else if (hasSentinel1VH) {
      // Use rendered_preview which has proper SAS token
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
      console.log("✅ Using VH polarization:", imageUrl);
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
       'modis-temperature', 'global-biomass', 'esa-worldcover'].includes(l.id)
    );
    
    // Auto-suggest but don't force change
    if (hasOther && !hasSentinel1 && activeSearchType === 'sentinel1') {
      setActiveSearchType('planetary');
    } else if (hasSentinel1 && !hasOther && activeSearchType === 'planetary') {
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

      {/* Water Analysis Component */}
      <WaterAnalysis aoi={currentAOI} onResultSelect={handleResultSelect} />
      
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
