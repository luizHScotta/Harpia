import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Search, Loader2, Calendar, MapPin, Image, Minimize2, Maximize2, Mountain, Radar, Leaf, Thermometer, TreePine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PlanetaryResult {
  id: string;
  datetime: string;
  geometry: any;
  bbox: number[];
  collection: string;
  assets: any;
  properties: any;
  platform: string;
  cloudCover?: number;
  assetKeys: string[];
}

interface PlanetarySearchProps {
  aoi: any | null;
  activeCollection: string;
  onResultSelect: (result: PlanetaryResult, collection: string, isMultiple?: boolean, index?: number) => void;
}

const COLLECTIONS = {
  'sentinel-2-l2a': { name: 'Sentinel-2 L2A', icon: Globe, color: 'text-optical' },
  'sentinel-1-grd': { name: 'Sentinel-1 SAR', icon: Radar, color: 'text-radar' },
  'landsat-c2-l2': { name: 'Landsat 8/9 L2', icon: Globe, color: 'text-optical' },
  'modis-09Q1-061': { name: 'MODIS Reflectância', icon: Globe, color: 'text-optical' },
  'modis-13A1-061': { name: 'MODIS Vegetação', icon: Leaf, color: 'text-vegetation' },
  'modis-17A3HGF-061': { name: 'MODIS Biomassa', icon: TreePine, color: 'text-biomass' },
  'modis-11A1-061': { name: 'MODIS Temperatura', icon: Thermometer, color: 'text-temperature' },
  'modis-21A2-061': { name: 'MODIS Temperatura LST', icon: Thermometer, color: 'text-temperature' },
  'hgb': { name: 'Biomassa Global', icon: TreePine, color: 'text-biomass' },
  'esa-worldcover': { name: 'ESA WorldCover', icon: Globe, color: 'text-landcover' },
  'cop-dem-glo-30': { name: 'Copernicus DEM 30m', icon: Mountain, color: 'text-topo' },
  'nasadem': { name: 'NASA DEM', icon: Mountain, color: 'text-topo' },
  'alos-dem': { name: 'ALOS World 3D', icon: Mountain, color: 'text-topo' },
};

const PlanetarySearch = ({ aoi, activeCollection, onResultSelect }: PlanetarySearchProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<PlanetaryResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [collection, setCollection] = useState<string>(activeCollection || 'sentinel-2-l2a');

  const handleSearch = async () => {
    if (!aoi) {
      toast.error("Defina uma área de interesse no mapa", {
        description: "Use a ferramenta de desenho para criar um polígono",
      });
      return;
    }

    setIsSearching(true);
    setShowResults(true);

    try {
      const startISO = new Date(startDate + 'T00:00:00Z').toISOString();
      const endISO = new Date(endDate + 'T23:59:59Z').toISOString();

      const { data, error } = await supabase.functions.invoke('search-planetary-data', {
        body: {
          aoi,
          startDate: startISO,
          endDate: endISO,
          maxResults: 50,
          collection: collection
        }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        toast.success(`${data.count} itens encontrados`, {
          description: `${COLLECTIONS[collection as keyof typeof COLLECTIONS]?.name || collection}`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      toast.error("Erro na busca", {
        description: error.message || "Tente novamente",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (datetime: string) => {
    return new Date(datetime).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const collectionInfo = COLLECTIONS[collection as keyof typeof COLLECTIONS];
  const CollectionIcon = collectionInfo?.icon || Globe;

  return (
    <div className="absolute top-20 right-4 w-80 z-10">
      <Card className="bg-card/95 backdrop-blur-sm border-border shadow-elevated">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CollectionIcon className={`h-5 w-5 ${collectionInfo?.color || 'text-primary'}`} />
              <h3 className="font-semibold text-foreground">Busca Planetary Computer</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </Button>
          </div>

          {!isMinimized && (
            <>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="collection" className="text-xs">Coleção</Label>
                  <Select value={collection} onValueChange={setCollection}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(COLLECTIONS).map(([key, info]) => (
                        <SelectItem key={key} value={key}>{info.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="startDate" className="text-xs">Data Inicial</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                
                <div className="space-y-1">
                  <Label htmlFor="endDate" className="text-xs">Data Final</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <Button
                onClick={handleSearch}
                disabled={isSearching || !aoi}
                className="w-full"
                variant="default"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Dados
                  </>
                )}
              </Button>

              {!aoi && (
                <p className="text-xs text-muted-foreground">
                  Desenhe um polígono no mapa para definir a área de interesse
                </p>
              )}

              {showResults && (
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">
                      Resultados ({results.length})
                    </span>
                    {results.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          results.forEach((result, index) => {
                            setTimeout(() => onResultSelect(result, collection, true, index), index * 100);
                          });
                          toast.success(`Carregando ${results.length} imagens...`);
                        }}
                        className="text-xs"
                      >
                        Carregar Todas
                      </Button>
                    )}
                  </div>

                  {results.length === 0 && !isSearching && (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      Nenhum item encontrado
                    </div>
                  )}

                  {results.map((result) => (
                    <Card
                      key={result.id}
                      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors border-l-2 border-l-primary"
                      onClick={() => onResultSelect(result, collection)}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-foreground">
                              {formatDate(result.datetime)}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {result.platform}
                          </span>
                        </div>

                        {result.cloudCover !== undefined && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>Nuvens: {result.cloudCover.toFixed(1)}%</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-xs">
                          <Image className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {result.assetKeys.length} assets disponíveis
                          </span>
                        </div>

                        <div className="pt-1 border-t border-border">
                          <span className="text-xs text-primary font-medium">
                            Clique para visualizar no mapa
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PlanetarySearch;
