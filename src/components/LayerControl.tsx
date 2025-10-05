import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { 
  Radar, 
  Satellite,
  Leaf, 
  Thermometer, 
  Droplets,
  AlertTriangle,
  Flame,
  Users
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export interface Layer {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  enabled: boolean;
  opacity: number;
  description: string;
}

interface LayerControlProps {
  layers: Layer[];
  onLayerToggle: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

const LayerControl = ({ layers, onLayerToggle, onOpacityChange }: LayerControlProps) => {
  const [openCategories, setOpenCategories] = useState<string[]>([
    "SAR",
    "Óptico",
    "Análises"
  ]);

  const categories = [
    { id: "SAR", name: "Dados SAR (Radar)", color: "text-sar" },
    { id: "Óptico", name: "Dados Ópticos", color: "text-optical" },
    { id: "Análises", name: "Produtos Derivados", color: "text-ndvi" },
    { id: "Socioambiental", name: "Socioambiental", color: "text-secondary" }
  ];

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Camadas de Dados
        </h2>
        <p className="text-xs text-muted-foreground">
          Selecione as camadas para visualizar no mapa
        </p>
      </div>

      {categories.map((category) => {
        const categoryLayers = layers.filter(l => l.category === category.id);
        if (categoryLayers.length === 0) return null;

        return (
          <Collapsible
            key={category.id}
            open={openCategories.includes(category.id)}
            onOpenChange={() => toggleCategory(category.id)}
          >
            <Card className="bg-card border-border">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <h3 className={`font-semibold ${category.color}`}>
                  {category.name}
                </h3>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    openCategories.includes(category.id) ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-4">
                  {categoryLayers.map((layer) => {
                    const Icon = layer.icon;
                    return (
                      <div key={layer.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4" style={{ color: layer.color }} />
                            <div className="flex-1">
                              <Label htmlFor={layer.id} className="text-sm font-medium">
                                {layer.name}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {layer.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            id={layer.id}
                            checked={layer.enabled}
                            onCheckedChange={() => onLayerToggle(layer.id)}
                          />
                        </div>
                        {layer.enabled && (
                          <div className="pl-7">
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground w-20">
                                Opacidade:
                              </Label>
                              <Slider
                                value={[layer.opacity]}
                                onValueChange={(value) => onOpacityChange(layer.id, value[0])}
                                max={100}
                                step={5}
                                className="flex-1"
                              />
                              <span className="text-xs text-muted-foreground w-8 text-right">
                                {layer.opacity}%
                              </span>
                            </div>
                          </div>
                        )}
                        {layer !== categoryLayers[categoryLayers.length - 1] && (
                          <Separator className="!mt-3" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};

export const defaultLayers: Layer[] = [
  {
    id: "sentinel1-vv",
    name: "Sentinel-1 VV",
    category: "SAR",
    icon: Radar,
    color: "hsl(200 80% 45%)",
    enabled: true,
    opacity: 100,
    description: "Backscatter VV polarização"
  },
  {
    id: "sentinel1-vh",
    name: "Sentinel-1 VH",
    category: "SAR",
    icon: Radar,
    color: "hsl(200 80% 60%)",
    enabled: false,
    opacity: 100,
    description: "Backscatter VH polarização"
  },
  {
    id: "sentinel2",
    name: "Sentinel-2 RGB",
    category: "Óptico",
    icon: Satellite,
    color: "hsl(120 60% 45%)",
    enabled: false,
    opacity: 80,
    description: "Imagem óptica true-color"
  },
  {
    id: "landsat",
    name: "Landsat 8/9",
    category: "Óptico",
    icon: Satellite,
    color: "hsl(150 60% 45%)",
    enabled: false,
    opacity: 80,
    description: "Imagem óptica Landsat"
  },
  {
    id: "ndvi",
    name: "NDVI",
    category: "Análises",
    icon: Leaf,
    color: "hsl(95 70% 45%)",
    enabled: false,
    opacity: 70,
    description: "Índice de vegetação"
  },
  {
    id: "lst",
    name: "LST (Temperatura)",
    category: "Análises",
    icon: Thermometer,
    color: "hsl(15 85% 55%)",
    enabled: false,
    opacity: 60,
    description: "Temperatura superfície terrestre"
  },
  {
    id: "flood",
    name: "Máscara de Inundação",
    category: "Análises",
    icon: Droplets,
    color: "hsl(210 85% 50%)",
    enabled: false,
    opacity: 65,
    description: "Áreas inundadas detectadas"
  },
  {
    id: "risk",
    name: "Risco Hidrogeológico",
    category: "Socioambiental",
    icon: AlertTriangle,
    color: "hsl(0 72% 51%)",
    enabled: false,
    opacity: 70,
    description: "Polígonos de risco SGB"
  },
  {
    id: "firms",
    name: "Hotspots FIRMS",
    category: "Socioambiental",
    icon: Flame,
    color: "hsl(25 95% 55%)",
    enabled: false,
    opacity: 100,
    description: "Detecção de focos de calor"
  },
  {
    id: "demographics",
    name: "Dados Socioeconômicos",
    category: "Socioambiental",
    icon: Users,
    color: "hsl(165 65% 45%)",
    enabled: false,
    opacity: 50,
    description: "Setores censitários IBGE"
  }
];

export default LayerControl;
