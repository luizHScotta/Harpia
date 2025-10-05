import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MapPin, 
  Satellite,
  Calendar,
  Minimize2,
  Maximize2,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface InfoPanelProps {
  data?: any;
  isOpen: boolean;
  searchResults?: any[];
  onImageSelect?: (result: any, collection: string) => void;
}

const InfoPanel = ({ data, isOpen, searchResults = [], onImageSelect }: InfoPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const { language, t } = useLanguage();
  const dateLocale = language === "pt" ? ptBR : enUS;

  if (!isOpen) return null;

  const getCollectionName = (collection: string) => {
    const names: Record<string, { en: string; pt: string }> = {
      'sentinel-1-grd': { en: 'Sentinel-1 SAR', pt: 'Sentinel-1 SAR' },
      'sentinel-2-l2a': { en: 'Sentinel-2 Optical', pt: 'Sentinel-2 Óptico' },
      'landsat-c2-l2': { en: 'Landsat', pt: 'Landsat' },
      'cop-dem-glo-30': { en: 'Copernicus DEM', pt: 'Copernicus DEM' },
      'nasadem': { en: 'NASA DEM', pt: 'NASA DEM' },
      'alos-dem': { en: 'ALOS DEM', pt: 'ALOS DEM' },
      'modis-09Q1-061': { en: 'MODIS Reflectance', pt: 'MODIS Reflectância' },
      'modis-13A1-061': { en: 'MODIS Vegetation', pt: 'MODIS Vegetação' },
      'modis-17A3HGF-061': { en: 'MODIS Biomass', pt: 'MODIS Biomassa' },
      'modis-11A1-061': { en: 'MODIS Temperature', pt: 'MODIS Temperatura' },
      'hgb': { en: 'Global Biomass', pt: 'Biomassa Global' },
      'esa-worldcover': { en: 'ESA WorldCover', pt: 'ESA WorldCover' }
    };
    const name = names[collection];
    return name ? name[language] : collection;
  };

  return (
    <div className="w-96 bg-card border-l border-border h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <h3 className="font-semibold text-foreground">
          {searchResults.length > 0 ? t("info.availableImages") : t("info.availableImages")}
        </h3>
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
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {searchResults.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Satellite className="h-4 w-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length} {searchResults.length === 1 ? t("info.imageFound") : t("info.imagesFound")}
                  </p>
                </div>
                
                {searchResults.map((result, index) => (
                  <Card 
                    key={result.id || index}
                    className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => onImageSelect?.(result, result.collection)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {getCollectionName(result.collection)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {result.id}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImageSelect?.(result, result.collection);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {format(new Date(result.datetime), language === "pt" ? "dd 'de' MMMM 'de' yyyy" : "MMMM dd, yyyy", { locale: dateLocale })}
                        </span>
                      </div>
                      
                      {result.platform && (
                        <div className="text-xs text-muted-foreground">
                          {t("info.platform")}: {result.platform}
                        </div>
                      )}
                      
                      {result.polarizations && result.polarizations.length > 0 && (
                        <div className="flex gap-1">
                          {result.polarizations.map((pol: string) => (
                            <Badge key={pol} variant="outline" className="text-xs">
                              {pol}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Satellite className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("info.noImages")}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default InfoPanel;
