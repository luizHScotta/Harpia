import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Radar, 
  Eye, 
  Leaf, 
  Thermometer, 
  Droplets,
  AlertTriangle,
  Flame,
  Users,
  Mountain,
  Satellite,
  TreePine,
  Globe
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
  onClearAll: () => void;
  aoi: any | null;
  onSearch: (startDate: string, endDate: string) => void;
  isSearching: boolean;
}

const LayerControl = ({ layers, onLayerToggle, onOpacityChange, onClearAll, aoi, onSearch, isSearching }: LayerControlProps) => {
  const { t } = useLanguage();
  const [openCategories, setOpenCategories] = useState<string[]>([
    "SAR",
    "Óptico",
    "Análises"
  ]);
  
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

  const categories = [
    { id: "SAR", name: t("layers.categories.sar"), color: "text-sar" },
    { id: "Óptico", name: t("layers.categories.optical"), color: "text-optical" },
    { id: "Topografia", name: t("layers.categories.topography"), color: "text-topo" },
    { id: "Análises", name: t("layers.categories.analysis"), color: "text-ndvi" },
    { id: "Socioambiental", name: t("layers.categories.socioenvironmental"), color: "text-secondary" }
  ];

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const hasActiveLayer = layers.some(l => l.enabled);

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {t("layers.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("layers.subtitle")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs"
          >
            {t("layers.clearAll")}
          </Button>
        </div>
      </div>

      {/* Search Controls - shown when layer is active */}
      {hasActiveLayer && (
        <Card className="bg-card border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("layers.search.title")}
          </h3>
          
          {aoi ? (
            <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
              <p className="text-xs text-foreground font-medium">
                {t("layers.search.areaSet")}
              </p>
            </div>
          ) : (
            <div className="p-2 bg-muted/50 rounded-md border border-border">
              <p className="text-xs text-muted-foreground">
                {t("layers.search.drawArea")}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="startDate" className="text-xs">{t("common.startDate")}</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs"
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="endDate" className="text-xs">{t("common.endDate")}</Label>
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
            onClick={() => onSearch(startDate, endDate)}
            disabled={isSearching || !aoi}
            className="w-full"
            variant="default"
            size="sm"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.searching")}
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                {t("common.search")}
              </>
            )}
          </Button>
        </Card>
      )}

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
                                {t(`layers.${layer.id}.name`)}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t(`layers.${layer.id}.desc`)}
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
                                {t("layers.search.opacity")}
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
    enabled: false,
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
    id: "dem",
    name: "Copernicus DEM",
    category: "Topografia",
    icon: Mountain,
    color: "hsl(30 70% 50%)",
    enabled: false,
    opacity: 70,
    description: "Modelo Digital de Elevação 30m"
  },
  {
    id: "nasadem",
    name: "NASA DEM",
    category: "Topografia",
    icon: Mountain,
    color: "hsl(25 70% 45%)",
    enabled: false,
    opacity: 70,
    description: "SRTM v3 NASA DEM"
  },
  {
    id: "alosdem",
    name: "ALOS World 3D",
    category: "Topografia",
    icon: Mountain,
    color: "hsl(35 70% 50%)",
    enabled: false,
    opacity: 70,
    description: "ALOS Global DEM 30m"
  },
  {
    id: "modis-reflectance",
    name: "MODIS Reflectância",
    category: "Óptico",
    icon: Satellite,
    color: "hsl(140 60% 45%)",
    enabled: false,
    opacity: 80,
    description: "MODIS 250m Reflectância"
  },
  {
    id: "modis-vegetation",
    name: "MODIS Vegetação",
    category: "Análises",
    icon: Leaf,
    color: "hsl(100 65% 45%)",
    enabled: false,
    opacity: 75,
    description: "MODIS Índice de Vegetação"
  },
  {
    id: "modis-biomass",
    name: "MODIS Biomassa",
    category: "Análises",
    icon: TreePine,
    color: "hsl(90 60% 40%)",
    enabled: false,
    opacity: 70,
    description: "MODIS Produtividade Primária"
  },
  {
    id: "modis-temperature",
    name: "MODIS Temperatura",
    category: "Análises",
    icon: Thermometer,
    color: "hsl(20 80% 50%)",
    enabled: false,
    opacity: 65,
    description: "MODIS Temperatura Superfície"
  },
  {
    id: "global-biomass",
    name: "Biomassa Global",
    category: "Análises",
    icon: TreePine,
    color: "hsl(85 55% 45%)",
    enabled: false,
    opacity: 70,
    description: "Harmonized Global Biomass"
  },
  {
    id: "esa-worldcover",
    name: "ESA WorldCover",
    category: "Análises",
    icon: Globe,
    color: "hsl(160 60% 45%)",
    enabled: false,
    opacity: 75,
    description: "Cobertura do Solo ESA 10m"
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
