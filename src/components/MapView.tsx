import { useEffect, useRef, useState } from "react";
import { Layer } from "./LayerControl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Box, Cuboid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCesiumToken } from "./CesiumTokenInput";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

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
  const cesiumContainer = useRef<HTMLDivElement>(null);
  const viewer = useRef<Cesium.Viewer | null>(null);
  const drawingHandler = useRef<Cesium.ScreenSpaceEventHandler | null>(null);
  const currentPolygon = useRef<Cesium.Entity | null>(null);
  const currentPositions = useRef<Cesium.Cartesian3[]>([]);
  const imageEntities = useRef<Cesium.Entity[]>([]);
  const labelEntities = useRef<Cesium.Entity[]>([]);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [currentImageResult, setCurrentImageResult] = useState<any>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const imageCache = useRef<Map<string, string>>(new Map());

  console.log("MapView render - mapLoaded:", mapLoaded);

  useEffect(() => {
    if (!cesiumContainer.current || viewer.current) return;

    console.log("🗺️ Inicializando Cesium...");
    
    try {
      // Create viewer without imagery provider to avoid CORS/decoding issues
      const viewerInstance = new Cesium.Viewer(cesiumContainer.current, {
        baseLayerPicker: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        skyBox: false,
        skyAtmosphere: false,
      });

      // Remove default imagery layer
      viewerInstance.imageryLayers.removeAll();

      // Add a solid color base
      viewerInstance.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a1a2e');

      viewer.current = viewerInstance;
      
      // Set initial camera position (Belém, Brazil)
      viewerInstance.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(-48.5044, -1.4558, 50000),
      });

      // Enable lighting
      viewerInstance.scene.globe.enableLighting = true;

      console.log("✅ Cesium viewer criado");
      setMapLoaded(true);

      // Add example polygon for Belém baixadas
      const belemPolygon = viewerInstance.entities.add({
        name: "Região da Baixada - Fazendinha",
        polygon: {
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            -48.52, -1.47,
            -48.49, -1.47,
            -48.49, -1.44,
            -48.52, -1.44
          ]),
          material: Cesium.Color.CYAN.withAlpha(0.2),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 2,
        },
        properties: {
          name: "Região da Baixada - Fazendinha",
          population: 45000,
          floodRisk: "Alto",
          avgNDVI: 0.35,
          avgLST: 32.5,
          sanitation: 45
        }
      });

      // Handle clicks on entities
      const clickHandler = new Cesium.ScreenSpaceEventHandler(viewerInstance.scene.canvas);
      clickHandler.setInputAction((click: any) => {
        const pickedObject = viewerInstance.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
          const props: any = {};
          const propertyNames = pickedObject.id.properties.propertyNames;
          propertyNames.forEach((name: string) => {
            props[name] = pickedObject.id.properties[name]._value;
          });
          onFeatureClick(props);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    } catch (error) {
      console.error("❌ Erro ao inicializar Cesium:", error);
      toast.error("Erro ao carregar o mapa");
    }

    return () => {
      console.log("🧹 Limpando mapa...");
      if (drawingHandler.current) {
        drawingHandler.current.destroy();
      }
      viewer.current?.destroy();
    };
  }, []);

  // Start drawing polygon
  const startDrawing = () => {
    if (!viewer.current || isDrawing) return;

    setIsDrawing(true);
    currentPositions.current = [];

    // Remove previous polygon
    if (currentPolygon.current) {
      viewer.current.entities.remove(currentPolygon.current);
      currentPolygon.current = null;
    }

    const viewerInstance = viewer.current;
    drawingHandler.current = new Cesium.ScreenSpaceEventHandler(viewerInstance.scene.canvas);

    // Left click to add point
    drawingHandler.current.setInputAction((click: any) => {
      const earthPosition = viewerInstance.camera.pickEllipsoid(
        click.position,
        viewerInstance.scene.globe.ellipsoid
      );

      if (earthPosition) {
        currentPositions.current.push(earthPosition);

        // Create or update polygon
        if (currentPolygon.current) {
          viewer.current?.entities.remove(currentPolygon.current);
        }

        if (currentPositions.current.length >= 2) {
          currentPolygon.current = viewerInstance.entities.add({
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(currentPositions.current),
              material: Cesium.Color.YELLOW.withAlpha(0.3),
              outline: true,
              outlineColor: Cesium.Color.YELLOW,
              outlineWidth: 2,
            },
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Right click to finish
    drawingHandler.current.setInputAction(() => {
      if (currentPositions.current.length >= 3) {
        finishDrawing();
      } else {
        toast.error("Desenhe pelo menos 3 pontos");
      }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    toast.info("Desenhe o polígono - Clique direito para finalizar");
  };

  const finishDrawing = () => {
    if (currentPositions.current.length < 3) return;

    // Convert Cartesian3 positions to GeoJSON
    const coordinates = currentPositions.current.map(pos => {
      const cartographic = Cesium.Cartographic.fromCartesian(pos);
      return [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude)
      ];
    });
    
    // Close the polygon
    coordinates.push(coordinates[0]);

    const geojson = {
      type: "Polygon",
      coordinates: [coordinates]
    };

    setCurrentAOI(geojson);
    onAOIChange(geojson);
    console.log("📍 AOI updated:", geojson);

    if (drawingHandler.current) {
      drawingHandler.current.destroy();
      drawingHandler.current = null;
    }

    setIsDrawing(false);
    toast.success("Área de interesse definida");
  };

  // Update layer visibility and opacity
  useEffect(() => {
    if (!mapLoaded || !viewer.current || !currentAOI || !currentImageResult) return;
    const activeLayers = layers.filter(l => l.enabled);
    console.log("Active layers:", activeLayers.map(l => l.name));

    updateImageOverlay(currentImageResult, activeLayers);
  }, [layers, mapLoaded, currentAOI, currentImageResult]);

  const clearAllPolygons = () => {
    if (currentPolygon.current && viewer.current) {
      viewer.current.entities.remove(currentPolygon.current);
      currentPolygon.current = null;
    }
    currentPositions.current = [];
    setCurrentAOI(null);
    setCurrentImageResult(null);
    removeImageOverlay();
    toast.success("Todos os polígonos removidos");
  };

  const toggle3DMode = () => {
    if (!viewer.current || !mapLoaded) {
      console.log("Map not ready for 3D toggle");
      return;
    }

    try {
      const new3DState = !is3DMode;
      setIs3DMode(new3DState);

      if (new3DState) {
        console.log("Activating 3D mode...");
        
        // Enable terrain
        Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true
        }).then(terrainProvider => {
          if (viewer.current) {
            viewer.current.terrainProvider = terrainProvider;
          }
        });

        // Tilt camera for 3D view
        const camera = viewer.current.camera;
        camera.setView({
          orientation: {
            heading: camera.heading,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
          }
        });

        toast.success("Modo 3D ativado");
      } else {
        console.log("Deactivating 3D mode...");
        
        // Disable terrain
        viewer.current.terrainProvider = new Cesium.EllipsoidTerrainProvider();

        // Reset camera
        const camera = viewer.current.camera;
        camera.setView({
          orientation: {
            heading: camera.heading,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0
          }
        });

        toast.success("Modo 2D ativado");
      }
    } catch (error) {
      console.error("Error toggling 3D mode:", error);
      toast.error("Erro ao alternar modo 3D");
    }
  };

  const removeImageOverlay = () => {
    if (!viewer.current) return;

    // Remove all image entities
    imageEntities.current.forEach(entity => {
      viewer.current?.entities.remove(entity);
    });
    imageEntities.current = [];

    // Remove all label entities
    labelEntities.current.forEach(entity => {
      viewer.current?.entities.remove(entity);
    });
    labelEntities.current = [];

    console.log("🗑️ All image overlays and labels removed");
  };

  const clipImageToPolygon = async (imageUrl: string, bbox: number[], polygonCoords: number[][]): Promise<string> => {
    const cacheKey = `${imageUrl}-${JSON.stringify(polygonCoords)}`;

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

          canvas.width = img.width;
          canvas.height = img.height;

          const [west, south, east, north] = bbox;
          const bboxWidth = east - west;
          const bboxHeight = north - south;

          const pixelCoords = polygonCoords.map(([lng, lat]) => {
            const x = (lng - west) / bboxWidth * canvas.width;
            const y = (north - lat) / bboxHeight * canvas.height;
            return [x, y];
          });

          ctx.beginPath();
          pixelCoords.forEach(([x, y], i) => {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.clip();

          ctx.drawImage(img, 0, 0);

          const clippedImageUrl = canvas.toDataURL('image/png');
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
    if (!viewer.current || !result || !currentAOI) return;

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
      'index-ndvi': ['ndvi'],
      'index-flood': ['flood']
    };

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

    // Get image URL based on collection
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
    } else if (collection === 'landsat-c2-l2') {
      imageUrl = result.assets?.rendered_preview?.href || `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=landsat-c2-l2&item=${result.id}&assets=red&assets=green&assets=blue&rescale=0,30000&format=png`;
      opacity = (activeLayers.find(l => l.id === 'landsat')?.opacity || 80) / 100;
    }

    if (!imageUrl) {
      console.error("❌ No image URL available");
      return;
    }

    console.log("🌍 Image URL to load:", imageUrl);

    try {
      const [west, south, east, north] = result.bbox;
      
      let finalImageUrl = imageUrl;
      if (currentAOI?.coordinates?.[0]) {
        const polygonCoords = currentAOI.coordinates[0];
        finalImageUrl = await clipImageToPolygon(imageUrl, result.bbox, polygonCoords);
        console.log("✂️ Image clipped to polygon");
      }

      // Add image as rectangle entity  
      const material = new Cesium.ImageMaterialProperty({
        image: finalImageUrl,
        transparent: true
      });
      
      const imageEntity = viewer.current!.entities.add({
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
          material: new Cesium.ColorMaterialProperty(
            new Cesium.Color(1, 1, 1, opacity)
          )
        }
      });

      // Override with image material
      (imageEntity.rectangle as any).material = material;

      imageEntities.current.push(imageEntity);

      // Add label at center
      const centerLng = (west + east) / 2;
      const centerLat = (south + north) / 2;

      const labelEntity = viewer.current!.entities.add({
        position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, 1000),
        label: {
          text: getCollectionDisplayName(collection || result.collection),
          font: '14px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      labelEntities.current.push(labelEntity);

      console.log(`✅ Image overlay ${layerIndex} added successfully - opacity: ${opacity}`);
      toast.success("Imagem sobreposta ao mapa", {
        description: `${getCollectionDisplayName(collection || result.collection)} - Opacidade: ${Math.round(opacity * 100)}%`
      });
    } catch (error) {
      console.error(`❌ Error updating image overlay ${layerIndex}:`, error);
      toast.error("Erro ao carregar overlay");
    }
  };

  const handleResultSelect = async (result: any, collection?: string, isMultiple: boolean = false, index: number = 0) => {
    console.log("🎯 Selected result:", result, "Collection:", collection);
    if (!viewer.current || !mapLoaded) {
      toast.error("Aguarde o mapa carregar");
      return;
    }

    try {
      if (!isMultiple) {
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

  const getActiveCollections = () => {
    const activeLayers = layers.filter(l => l.enabled);
    const collections: string[] = [];

    if (activeLayers.some(l => l.id === 'sentinel2')) collections.push('sentinel-2-l2a');
    if (activeLayers.some(l => l.id === 'landsat')) collections.push('landsat-c2-l2');
    if (activeLayers.some(l => l.id === 'dem')) collections.push('cop-dem-glo-30');

    return collections;
  };

  const handleSearch = async (startDate: string, endDate: string) => {
    console.log("🔍 handleSearch called - currentAOI:", currentAOI);
    
    if (!currentAOI) {
      toast.error("Defina uma área de interesse no mapa", {
        description: "Use o botão de desenho para criar um polígono"
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

      const results = await Promise.all(searchPromises);

      let allResults: any[] = [];
      let totalCount = 0;

      for (const result of results) {
        if (result.error) {
          console.error(`Erro ao buscar ${result.collection}:`, result.error);
          continue;
        }
        if (result.data?.success && result.data.results?.length > 0) {
          const resultsWithCollection = result.data.results.map((r: any) => ({
            ...r,
            collection: result.collection
          }));
          allResults = [...allResults, ...resultsWithCollection];
          totalCount += result.data.results.length;
        }
      }

      if (allResults.length > 0) {
        allResults.sort((a, b) => 
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
        );

        toast.success(`${totalCount} imagens encontradas`, {
          description: `Mostrando resultado mais recente`
        });

        await handleResultSelect(allResults[0], allResults[0].collection);
        onSearchComplete(handleSearch, false, allResults, handleResultSelect);
      } else {
        toast.info("Nenhuma imagem encontrada", {
          description: "Tente ajustar o período ou a área"
        });
        onSearchComplete(handleSearch, false, [], handleResultSelect);
      }
    } catch (error) {
      console.error("❌ Search error:", error);
      toast.error("Erro na busca", {
        description: "Verifique o console para detalhes"
      });
      onSearchComplete(handleSearch, false, [], handleResultSelect);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    onSearchComplete(handleSearch, isSearching);
  }, [isSearching]);

  return (
    <div className="relative w-full h-full">
      <div ref={cesiumContainer} className="absolute inset-0" />
      
      {/* Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={startDrawing}
          disabled={isDrawing}
          className="gap-2"
        >
          <Box className="h-4 w-4" />
          {isDrawing ? "Desenhando..." : "Desenhar Área"}
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          onClick={clearAllPolygons}
          className="gap-2"
        >
          Limpar Polígonos
        </Button>

        <Button
          variant={is3DMode ? "default" : "secondary"}
          size="sm"
          onClick={toggle3DMode}
          className="gap-2"
        >
          <Cuboid className="h-4 w-4" />
          Modo {is3DMode ? "2D" : "3D"}
        </Button>
      </div>

      {/* Watermark */}
      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded z-10">
        Powered by Cesium
      </div>

      {/* Active layers legend */}
      {layers.filter(l => l.enabled).length > 0 && (
        <div className="absolute bottom-4 left-4 bg-background/90 p-3 rounded-lg border max-w-xs z-10">
          <h4 className="text-xs font-semibold mb-2">Camadas Ativas</h4>
          <div className="flex flex-wrap gap-1">
            {layers.filter(l => l.enabled).map(layer => (
              <div
                key={layer.id}
                className="text-xs px-2 py-1 rounded bg-primary/20 text-primary"
              >
                {layer.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
