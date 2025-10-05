import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Droplets, Leaf, CloudRain, Radar, Image, Loader2 } from "lucide-react";

interface WaterAnalysisProps {
  aoi: any;
  onResultSelect: (result: any) => void;
}

const INDEX_TYPES = {
  'ndwi': { 
    label: 'NDWI - Água', 
    icon: Droplets, 
    color: 'hsl(210 85% 50%)',
    description: 'Detecta corpos d\'água e áreas inundadas'
  },
  'ndvi': { 
    label: 'NDVI - Vegetação', 
    icon: Leaf, 
    color: 'hsl(95 70% 45%)',
    description: 'Mede densidade e saúde da vegetação'
  },
  'ndmi': { 
    label: 'NDMI - Umidade', 
    icon: CloudRain, 
    color: 'hsl(180 65% 45%)',
    description: 'Avalia conteúdo de água na vegetação'
  },
  'sar-water': { 
    label: 'SAR - Backscatter', 
    icon: Radar, 
    color: 'hsl(200 80% 45%)',
    description: 'Detecta água usando radar (funciona sob nuvens)'
  },
  'false-color': { 
    label: 'Infravermelho', 
    icon: Image, 
    color: 'hsl(340 75% 55%)',
    description: 'Visualização em falsa cor para análise visual'
  }
};

const WaterAnalysis = ({ aoi, onResultSelect }: WaterAnalysisProps) => {
  const [indexType, setIndexType] = useState<keyof typeof INDEX_TYPES>('ndwi');
  const [threshold, setThreshold] = useState([0.2]);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const [dates, setDates] = useState(getDefaultDates());

  const handleSearch = async () => {
    if (!aoi) {
      toast.error("Desenhe uma área de interesse no mapa");
      return;
    }

    setIsSearching(true);
    setShowResults(false);

    try {
      // Determine collection based on index type
      let collection = 'sentinel-2-l2a';
      if (indexType === 'sar-water') {
        collection = 'sentinel-1-grd';
      }

      const { data, error } = await supabase.functions.invoke('process-water-index', {
        body: {
          aoi,
          startDate: dates.startDate,
          endDate: dates.endDate,
          collection,
          indexType,
          threshold: threshold[0]
        }
      });

      if (error) throw error;

      if (data?.success && data.results.length > 0) {
        setResults(data.results);
        setShowResults(true);
        toast.success(`✅ ${data.count} cena${data.count > 1 ? 's' : ''} encontrada${data.count > 1 ? 's' : ''}`, {
          description: `Índice: ${INDEX_TYPES[indexType].label}`
        });
      } else {
        toast.warning("Nenhum dado encontrado", {
          description: "Tente ajustar a data ou área de interesse"
        });
      }
    } catch (error: any) {
      console.error('Erro na busca:', error);
      toast.error("Erro ao processar índice", {
        description: error.message
      });
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (datetime: string) => {
    return new Date(datetime).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedIndex = INDEX_TYPES[indexType];
  const Icon = selectedIndex.icon;

  return (
    <Card className="absolute top-20 right-4 w-96 max-h-[calc(100vh-120px)] overflow-y-auto shadow-elevated z-[1000]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" style={{ color: selectedIndex.color }} />
          Análise de Índices
        </CardTitle>
        <CardDescription>
          Calcule índices espectrais e detecte mudanças
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Index Type Selector */}
        <div className="space-y-2">
          <Label>Tipo de Índice</Label>
          <Select value={indexType} onValueChange={(v) => setIndexType(v as keyof typeof INDEX_TYPES)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INDEX_TYPES).map(([key, config]) => {
                const ItemIcon = config.icon;
                return (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <ItemIcon className="h-4 w-4" style={{ color: config.color }} />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{selectedIndex.description}</p>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <input
              type="date"
              value={dates.startDate}
              onChange={(e) => setDates(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final</Label>
            <input
              type="date"
              value={dates.endDate}
              onChange={(e) => setDates(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>

        {/* Threshold Slider (não aplicável para false-color) */}
        {indexType !== 'false-color' && (
          <div className="space-y-2">
            <Label>
              Limiar: {threshold[0].toFixed(2)}
              {indexType === 'sar-water' && ' dB'}
            </Label>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              min={indexType === 'sar-water' ? -25 : -1}
              max={indexType === 'sar-water' ? -5 : 1}
              step={0.01}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {indexType === 'ndwi' && 'Valores > limiar = água'}
              {indexType === 'ndvi' && 'Valores > limiar = vegetação densa'}
              {indexType === 'ndmi' && 'Valores > limiar = alta umidade'}
              {indexType === 'sar-water' && 'Valores < limiar = água'}
            </p>
          </div>
        )}

        {/* Search Button */}
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !aoi}
          className="w-full"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>Buscar e Processar</>
          )}
        </Button>

        {/* Results */}
        {showResults && results.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <Label>Resultados ({results.length})</Label>
            {results.map((result) => (
              <Card 
                key={result.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => onResultSelect(result)}
              >
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{formatDate(result.datetime)}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.stats.platform}
                      </p>
                      {result.stats.cloudCover !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          ☁️ {result.stats.cloudCover.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <Icon className="h-4 w-4" style={{ color: selectedIndex.color }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WaterAnalysis;
