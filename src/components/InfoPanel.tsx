import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Users, 
  Droplets, 
  Leaf, 
  Thermometer,
  AlertTriangle 
} from "lucide-react";

interface InfoPanelProps {
  data: any;
  isOpen: boolean;
}

const InfoPanel = ({ data, isOpen }: InfoPanelProps) => {
  if (!isOpen || !data) return null;

  const getRiskColor = (risk: string | undefined) => {
    if (!risk) return "bg-muted";
    
    switch (risk.toLowerCase()) {
      case "alto":
        return "bg-risk-high";
      case "médio":
        return "bg-risk-medium";
      case "baixo":
        return "bg-risk-low";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="w-96 bg-card border-l border-border h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3 mb-3">
            <MapPin className="h-5 w-5 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {data.name || "Área Selecionada"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Dados da última semana
              </p>
            </div>
          </div>
          <Badge className={`${getRiskColor(data.floodRisk)} text-white`}>
            Risco de Inundação: {data.floodRisk}
          </Badge>
        </div>

        <Separator />

        {/* Demographics */}
        <Card className="bg-gradient-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-secondary" />
            <h4 className="font-semibold text-foreground">Dados Socioeconômicos</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">População estimada:</span>
              <span className="font-medium text-foreground">
                {data.population?.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Saneamento adequado:</span>
              <span className="font-medium text-foreground">{data.sanitation}%</span>
            </div>
          </div>
        </Card>

        {/* Environmental Data */}
        <Card className="bg-gradient-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="h-4 w-4 text-ndvi" />
            <h4 className="font-semibold text-foreground">Indicadores Ambientais</h4>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">NDVI Médio (vegetação):</span>
                <span className="font-medium text-foreground">{data.avgNDVI}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-ndvi transition-all"
                  style={{ width: `${(data.avgNDVI / 1) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Thermometer className="h-3 w-3 text-lst" />
                <span className="text-muted-foreground">Temp. Superfície (LST):</span>
              </div>
              <span className="font-medium text-foreground">{data.avgLST}°C</span>
            </div>
          </div>
        </Card>

        {/* Risk Analysis */}
        <Card className="bg-gradient-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="h-4 w-4 text-flood" />
            <h4 className="font-semibold text-foreground">Análise de Inundação</h4>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Área com histórico de alagamentos frequentes durante período chuvoso.
            Dados SAR indicam presença de água em 15% da área nos últimos 7 dias.
          </p>
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
            <AlertTriangle className="h-4 w-4 text-risk-medium mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Recomenda-se monitoramento contínuo e implementação de sistemas de drenagem.
            </p>
          </div>
        </Card>

        {/* FIRMS Hotspots */}
        <Card className="bg-gradient-card p-4">
          <h4 className="font-semibold text-foreground mb-2">
            Focos de Calor (FIRMS)
          </h4>
          <p className="text-sm text-muted-foreground">
            Nenhum foco de calor detectado nos últimos 7 dias nesta área.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default InfoPanel;
