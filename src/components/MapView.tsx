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
  const [satelliteLayers, setSatelliteLayers] = useState<SatelliteLayer[]>([]);
  const addedLayerIds = useRef<Set<string>>(new Set());

  console.log("MapView render - mapLoaded:", mapLoaded, "satelliteLayers:", satelliteLayers.length);

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

  // Update layer visibility and opacity
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // This is where you would update actual layer visibility
    // For now, just logging the active layers
    const activeLayers = layers.filter(l => l.enabled);
    console.log("Active layers:", activeLayers.map(l => l.name));
    
    // In a real implementation, you would:
    // 1. Load raster tiles from your COG storage
    // 2. Load vector tiles from your TileServer
    // 3. Update layer opacity based on slider values
  }, [layers, mapLoaded]);

  const handleResultSelect = async (result: any) => {
    if (!map.current || !mapLoaded) return;
    
    console.log("Selected result:", result);

    try {
      const mapInstance = map.current;
      
      // Use the rendered preview image URL directly from Planetary Computer
      // This is a pre-rendered PNG image that's ready to display
      const previewUrl = result.assets?.rendered_preview?.href || 
                        result.assets?.thumbnail?.href;
      
      if (!previewUrl) {
        throw new Error("No preview image available for this item");
      }

      console.log("Using preview image:", previewUrl);

      const layerId = `sentinel1-${result.id}`;
      const sourceId = `${layerId}-source`;
      
      // Remove old layer if exists
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }

      // Get the bbox coordinates [west, south, east, north]
      const [west, south, east, north] = result.bbox;
      
      // Add image source with the preview URL
      mapInstance.addSource(sourceId, {
        type: 'image',
        url: previewUrl,
        coordinates: [
          [west, north],  // top-left
          [east, north],  // top-right
          [east, south],  // bottom-right
          [west, south]   // bottom-left
        ]
      });

      // Add raster layer
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.7,
          'raster-fade-duration': 300
        }
      });

      // Fit map to image bounds
      mapInstance.fitBounds([[west, south], [east, north]], {
        padding: 50,
        duration: 1000
      });

      console.log("Image layer added successfully:", layerId);

      toast.success("Imagem SAR adicionada", {
        description: `Sentinel-1 ${result.platform} - ${new Date(result.datetime).toLocaleDateString('pt-BR')}`
      });

      // Show result info
      onFeatureClick({
        name: result.id,
        date: new Date(result.datetime).toLocaleDateString('pt-BR'),
        platform: result.platform,
        polarizations: result.polarizations?.join(', ') || 'N/A',
        mode: result.instrumentMode,
        collection: result.collection
      });
      
    } catch (error) {
      console.error("Error loading satellite layer:", error);
      toast.error("Erro ao carregar imagem", {
        description: error instanceof Error ? error.message : "Não foi possível carregar a imagem"
      });
    }
  };

  // Effect to add/update satellite layers on map
  useEffect(() => {
    if (!mapLoaded || !map.current) {
      console.log("Skipping layer update - map not ready");
      return;
    }

    const mapInstance = map.current;
    if (!mapInstance) return;

    console.log("Updating satellite layers:", satelliteLayers.length);

    satelliteLayers.forEach(layer => {
      const sourceId = `${layer.id}-source`;
      const layerId = `${layer.id}-layer`;

      try {
        // Remove old layer and source if exists
        if (addedLayerIds.current.has(layerId)) {
          if (mapInstance.getLayer(layerId)) {
            mapInstance.removeLayer(layerId);
          }
          if (mapInstance.getSource(sourceId)) {
            mapInstance.removeSource(sourceId);
          }
        }

        // Add new raster source and layer
        if (!mapInstance.getSource(sourceId)) {
          const [minLng, minLat, maxLng, maxLat] = layer.bbox;
          
          mapInstance.addSource(sourceId, {
            type: 'raster',
            tiles: [layer.url],
            tileSize: 256,
            bounds: [minLng, minLat, maxLng, maxLat]
          });

          mapInstance.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': layer.opacity || 0.5,
              'raster-fade-duration': 300,
              'raster-brightness-max': 1,
              'raster-contrast': 0.2
            }
          }); // Add on top of base map

          addedLayerIds.current.add(layerId);
          console.log("Added layer:", layerId);
        }
      } catch (error) {
        console.error("Error adding layer:", layerId, error);
      }
    });

    // Clean up old layers not in current state
    try {
      addedLayerIds.current.forEach(layerId => {
        const exists = satelliteLayers.some(l => `${l.id}-layer` === layerId);
        if (!exists && mapInstance) {
          const sourceId = layerId.replace('-layer', '-source');
          if (mapInstance.getLayer(layerId)) {
            mapInstance.removeLayer(layerId);
          }
          if (mapInstance.getSource(sourceId)) {
            mapInstance.removeSource(sourceId);
          }
          addedLayerIds.current.delete(layerId);
          console.log("Removed layer:", layerId);
        }
      });
    } catch (error) {
      console.error("Error cleaning up layers:", error);
    }
  }, [satelliteLayers, mapLoaded]);

  return (
    <div className="w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      <Sentinel1Search aoi={currentAOI} onResultSelect={handleResultSelect} />
      
      {/* Overlay watermark */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground z-10">
        <span className="font-semibold">Belém</span> - Monitoramento Geoespacial
      </div>

      {/* Legend */}
      {(layers.some(l => l.enabled) || satelliteLayers.length > 0) && (
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
            {satelliteLayers.length > 0 && (
              <>
                {layers.some(l => l.enabled) && <div className="border-t border-border my-2" />}
                {satelliteLayers.map(layer => (
                  <div key={layer.id} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-sar-primary" />
                    <span className="text-xs text-foreground">Sentinel-1 SAR</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round((layer.opacity || 0.7) * 100)}%
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
