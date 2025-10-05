import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layer } from "./LayerControl";
import Sentinel1Search from "./Sentinel1Search";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
      console.log("Mapbox map loaded");
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

  // Update layer visibility
  useEffect(() => {
    if (!mapLoaded || !map.current || !currentAOI || !currentImageResult) return;

    const activeLayers = layers.filter(l => l.enabled);
    updateImageOverlay(currentImageResult, activeLayers);
  }, [layers, mapLoaded, currentAOI, currentImageResult]);

  const clearAllPolygons = () => {
    if (draw.current && map.current) {
      try {
        draw.current.deleteAll();
        setCurrentAOI(null);
        setCurrentImageResult(null);
        removeImageOverlay();
        toast.success("Polígonos removidos");
      } catch (error) {
        console.error("Error clearing polygons:", error);
      }
    }
  };

  const removeImageOverlay = () => {
    if (!map.current) return;
    
    const mapInstance = map.current;
    
    // Remove all overlays
    for (let i = 0; i < 10; i++) {
      const layerId = i === 0 ? 'sar-overlay' : `sar-overlay-${i}`;
      const sourceId = `${layerId}-source`;
      
      try {
        if (mapInstance.getLayer(layerId)) {
          mapInstance.removeLayer(layerId);
        }
      } catch (e) {
        // Layer doesn't exist
      }
      
      try {
        if (mapInstance.getSource(sourceId)) {
          mapInstance.removeSource(sourceId);
        }
      } catch (e) {
        // Source doesn't exist
      }
    }
  };

  const updateImageOverlay = async (result: any, activeLayers: Layer[], layerIndex: number = 0, collection?: string) => {
    if (!map.current || !result || !mapLoaded) return;
    
    const mapInstance = map.current;
    
    // Determine which image to load
    const hasSentinel1VV = activeLayers.some(l => l.id === 'sentinel1-vv');
    const hasSentinel1VH = activeLayers.some(l => l.id === 'sentinel1-vh');
    const hasSentinel2 = activeLayers.some(l => l.id === 'sentinel2');
    const hasLandsat = activeLayers.some(l => l.id === 'landsat');
    
    let imageUrl = null;
    let opacity = 0.75;
    
    
    // Priority: Sentinel-1 VV/VH composite, then individual polarizations
    if (hasSentinel1VV && hasSentinel1VH && (!collection || collection.includes('sentinel-1'))) {
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = Math.max(
        activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
        activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
      ) / 100;
    } else if (hasSentinel1VV && (!collection || collection.includes('sentinel-1'))) {
      imageUrl = result.assets?.vv?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
    } else if (hasSentinel1VH && (!collection || collection.includes('sentinel-1'))) {
      imageUrl = result.assets?.vh?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
    } else if (hasSentinel2 && collection === 'sentinel-2-l2a') {
      imageUrl = result.assets?.visual?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel2')?.opacity || 80) / 100;
    } else if (hasLandsat && collection === 'landsat-c2-l2') {
      imageUrl = result.assets?.rendered_preview?.href || result.assets?.visual?.href;
      opacity = (activeLayers.find(l => l.id === 'landsat')?.opacity || 80) / 100;
    } else {
      return;
    }
    
    if (!imageUrl) {
      console.error("No image URL for:", result.id);
      return;
    }

    const layerId = layerIndex === 0 ? 'sar-overlay' : `sar-overlay-${layerIndex}`;
    const sourceId = `${layerId}-source`;
    
    try {
      // Remove old overlay
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }

      const [west, south, east, north] = result.bbox;
      
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

      // Add raster layer
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300
        }
      });

      console.log(`✅ Image overlay ${layerIndex} loaded`);
      
    } catch (error) {
      console.error(`Error loading overlay ${layerIndex}:`, error);
    }
  };

  const handleResultSelect = async (result: any, collection?: string, isMultiple: boolean = false, index: number = 0) => {
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

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      <Sentinel1Search aoi={currentAOI} onResultSelect={handleResultSelect} />
      
      {/* Botões de controle */}
      {currentAOI && (
        <div className="absolute top-20 left-4 z-10">
          <Button
            onClick={clearAllPolygons}
            variant="destructive"
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
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Limpar Polígonos
          </Button>
        </div>
      )}
      
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
