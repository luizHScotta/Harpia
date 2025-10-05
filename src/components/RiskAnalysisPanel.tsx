import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, TrendingUp, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RiskAnalysisPanelProps {
  aoi: any;
  layers: any[];
  searchResults?: any[];
}

const RiskAnalysisPanel = ({ aoi, layers, searchResults }: RiskAnalysisPanelProps) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!aoi) {
      toast.error("Defina uma área de interesse primeiro");
      return;
    }

    setIsAnalyzing(true);
    try {
      const activeLayers = layers.filter(l => l.enabled);
      
      const { data, error } = await supabase.functions.invoke('analyze-risk-areas', {
        body: {
          aoi,
          layerData: activeLayers.map(l => ({
            id: l.id,
            name: l.name,
            category: l.category,
            opacity: l.opacity
          })),
          searchResults: searchResults?.map(r => ({
            collection: r.collection,
            datetime: r.datetime,
            bbox: r.bbox,
            platform: r.platform
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
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Resultado da Análise</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <pre className="whitespace-pre-wrap text-xs leading-relaxed font-sans">
                {analysis}
              </pre>
            </div>
          </div>
        </ScrollArea>
      )}

      <div className="text-xs text-muted-foreground pt-2 border-t">
        <p>
          A análise utiliza IA para identificar áreas de risco com base nos dados
          de sensoriamento remoto, topografia e informações contextuais.
        </p>
      </div>
    </Card>
  );
};

export default RiskAnalysisPanel;
