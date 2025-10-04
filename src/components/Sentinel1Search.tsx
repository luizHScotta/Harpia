import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Satellite, Search, Loader2, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Sentinel1Result {
  id: string;
  datetime: string;
  geometry: any;
  polarizations: string[];
  platform: string;
  instrumentMode: string;
  productType: string;
  bbox: number[];
}

interface Sentinel1SearchProps {
  aoi: any | null;
  onResultSelect: (result: Sentinel1Result) => void;
}

const Sentinel1Search = ({ aoi, onResultSelect }: Sentinel1SearchProps) => {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Sentinel1Result[]>([]);
  const [showResults, setShowResults] = useState(false);

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
      // Get last 90 days
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase.functions.invoke('search-sentinel1', {
        body: {
          aoi,
          startDate,
          endDate,
          maxResults: 20
        }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        toast.success(`${data.count} cenas encontradas`, {
          description: "Últimos 90 dias de dados Sentinel-1",
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="absolute top-20 right-4 w-80 z-10">
      <Card className="bg-card/95 backdrop-blur-sm border-border shadow-elevated">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Satellite className="h-5 w-5 text-sar-primary" />
            <h3 className="font-semibold text-foreground">Busca Sentinel-1</h3>
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
                Buscar Dados SAR
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
              </div>

              {results.length === 0 && !isSearching && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Nenhuma cena encontrada
                </div>
              )}

              {results.map((result) => (
                <Card
                  key={result.id}
                  className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => onResultSelect(result)}
                >
                  <div className="space-y-1">
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

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{result.instrumentMode}</span>
                      <span>•</span>
                      <span>{result.polarizations.join(', ')}</span>
                    </div>

                    <div className="text-xs text-muted-foreground truncate" title={result.id}>
                      {result.id}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Sentinel1Search;
