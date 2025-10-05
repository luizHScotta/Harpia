import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, TrendingUp, Shield, Volume2, VolumeX, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';

interface RiskAnalysisPanelProps {
  aoi: any;
  layers: any[];
  searchResults?: any[];
  municipioId?: string;
}

const RiskAnalysisPanel = ({ aoi, layers, searchResults, municipioId }: RiskAnalysisPanelProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textSize, setTextSize] = useState(16);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const runAnalysis = async () => {
    if (!aoi) {
      toast.error("Defina uma área de interesse primeiro");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Buscar dados populacionais se municipioId estiver disponível
      let populationData = null;
      if (municipioId) {
        try {
          const { data: popData } = await supabase.functions.invoke('get-ibge-population', {
            body: { municipioId }
          });
          if (popData?.success) {
            populationData = popData;
          }
        } catch (popError) {
          console.warn('Não foi possível obter dados populacionais:', popError);
        }
      }

      const activeLayers = layers
        .filter(l => l.enabled)
        .map(l => ({
          id: l.id,
          name: l.name,
          category: l.category,
          opacity: l.opacity
        }));
      
      const { data, error } = await supabase.functions.invoke('analyze-risk-areas', {
        body: {
          aoi,
          layerData: activeLayers,
          searchResults: searchResults?.map(r => ({
            collection: r.collection,
            datetime: r.datetime,
            bbox: r.bbox,
            platform: r.platform,
            populationData
          }))
        }
      });

      if (error) throw error;

      if (data.success) {
        setAnalysis(data.analysis);
        toast.success("Análise concluída", {
          description: "Veja os resultados abaixo"
        });
      } else {
        throw new Error(data.error || 'Análise falhou');
      }
    } catch (error) {
      console.error('Erro na análise:', error);
      toast.error("Erro ao executar análise", {
        description: error instanceof Error ? error.message : "Tente novamente"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSpeech = () => {
    if (!analysis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      // Remover markdown para melhor leitura
      const textToSpeak = analysis
        .replace(/[#*`|]/g, '')
        .replace(/\n+/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        toast.error('Erro ao reproduzir áudio');
      };

      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const increaseTextSize = () => {
    setTextSize(prev => Math.min(prev + 2, 24));
  };

  const decreaseTextSize = () => {
    setTextSize(prev => Math.max(prev - 2, 12));
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="text-sm font-semibold">Análise de Risco com IA</h3>
        </div>
        <Button
          onClick={runAnalysis}
          disabled={isAnalyzing || !aoi}
          size="sm"
          variant="default"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 mr-2" />
              Executar Análise
            </>
          )}
        </Button>
      </div>

      {!aoi && (
        <div className="p-3 bg-muted/50 rounded-md border border-border">
          <p className="text-xs text-muted-foreground">
            Desenhe uma área no mapa e ative camadas para análise
          </p>
        </div>
      )}

      {analysis && (
        <>
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Resultado da Análise</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={decreaseTextSize}
                disabled={textSize <= 12}
                title="Diminuir texto"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[40px] text-center">{textSize}px</span>
              <Button
                size="sm"
                variant="outline"
                onClick={increaseTextSize}
                disabled={textSize >= 24}
                title="Aumentar texto"
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleSpeech}
                title={isSpeaking ? "Parar leitura" : "Ler análise"}
              >
                {isSpeaking ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[500px] w-full rounded-md border p-4">
            <div 
              className="prose prose-sm dark:prose-invert max-w-none"
              style={{ fontSize: `${textSize}px` }}
            >
              <ReactMarkdown
                components={{
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-border" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-border px-4 py-2 bg-muted font-semibold text-left" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-border px-4 py-2" {...props} />
                  ),
                }}
              >
                {analysis}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        </>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t">
        <p>
          A análise utiliza IA para identificar áreas de risco com base nos dados
          de sensoriamento remoto, topografia, informações populacionais e contextuais.
        </p>
      </div>
    </Card>
  );
};

export default RiskAnalysisPanel;
