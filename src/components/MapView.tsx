import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { Layer } from "./LayerControl";
import Sentinel1Search from "./Sentinel1Search";
import { toast } from "sonner";

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
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-48.5044, -1.4558], // Belém coordinates
      zoom: 11,
      pitch: 0,
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
        trash: true
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
        const polygon = data.features[0];
        setCurrentAOI(polygon.geometry);
        console.log("AOI updated:", polygon.geometry);
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

  const removeImageOverlay = () => {
    if (!map.current) return;
    
    const mapInstance = map.current;
    const layerId = `sar-overlay`;
    const sourceId = `${layerId}-source`;
    
    try {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
      console.log("🗑️ Image overlay removed");
    } catch (e) {
      console.log("No overlay to remove");
    }
  };

  const updateImageOverlay = async (result: any, activeLayers: Layer[]) => {
    if (!map.current || !result) return;
    
    const mapInstance = map.current;
    
    // Determine which image to load based on active layers
    const hasSentinel1VV = activeLayers.some(l => l.id === 'sentinel1-vv');
    const hasSentinel1VH = activeLayers.some(l => l.id === 'sentinel1-vh');
    const hasSentinel2 = activeLayers.some(l => l.id === 'sentinel2');
    
    let imageUrl = null;
    let opacity = 0.75;
    
    // Priority: Sentinel-1 VV/VH composite, then individual polarizations
    if (hasSentinel1VV && hasSentinel1VH) {
      // Use false-color composite (VV, VH)
      imageUrl = result.assets?.rendered_preview?.href;
      opacity = Math.max(
        activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100,
        activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100
      ) / 100;
    } else if (hasSentinel1VV) {
      // Use VV polarization
      imageUrl = result.assets?.vv?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vv')?.opacity || 100) / 100;
    } else if (hasSentinel1VH) {
      // Use VH polarization
      imageUrl = result.assets?.vh?.href || result.assets?.rendered_preview?.href;
      opacity = (activeLayers.find(l => l.id === 'sentinel1-vh')?.opacity || 100) / 100;
    } else if (hasSentinel2) {
      // For Sentinel-2, we would need to fetch from a different collection
      // For now, show a message
      toast.info("Sentinel-2 ainda não implementado", {
        description: "Use as camadas Sentinel-1 para visualizar dados SAR"
      });
      removeImageOverlay();
      return;
    } else {
      // No relevant layers enabled, remove overlay
      removeImageOverlay();
      return;
    }
    
    if (!imageUrl) {
      console.error("No image URL available");
      return;
    }

    const layerId = `sar-overlay`;
    const sourceId = `${layerId}-source`;
    
    try {
      // Remove old overlay if exists
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

      // Add raster layer with dynamic opacity
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 300
        }
      });

      console.log(`✅ Image overlay updated - opacity: ${opacity}`);
      
    } catch (error) {
      console.error("❌ Error updating image overlay:", error);
    }
  };

  const handleResultSelect = async (result: any) => {
    console.log("🎯 Selected SAR result:", result);

    if (!map.current || !mapLoaded) {
      toast.error("Aguarde o mapa carregar");
      return;
    }

    try {
      setCurrentImageResult(result);
      
      const activeLayers = layers.filter(l => l.enabled);
      await updateImageOverlay(result, activeLayers);

      // Fit map to image bounds
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
      
    } catch (error) {
      console.error("❌ Error loading image:", error);
      toast.error("Erro ao carregar imagem");
    }
  };

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      <Sentinel1Search aoi={currentAOI} onResultSelect={handleResultSelect} />
      
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
