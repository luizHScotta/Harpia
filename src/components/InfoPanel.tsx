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
import { ptBR } from "date-fns/locale";

interface InfoPanelProps {
  data?: any;
  isOpen: boolean;
  searchResults?: any[];
  onImageSelect?: (result: any, collection: string) => void;
}

const InfoPanel = ({ data, isOpen, searchResults = [], onImageSelect }: InfoPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const getCollectionName = (collection: string) => {
    const names: Record<string, string> = {
      'sentinel-1-grd': 'Sentinel-1 SAR',
      'sentinel-2-l2a': 'Sentinel-2 Óptico',
      'landsat-c2-l2': 'Landsat',
      'cop-dem-glo-30': 'Copernicus DEM',
      'nasadem': 'NASA DEM',
      'alos-dem': 'ALOS DEM',
      'modis-09Q1-061': 'MODIS Reflectância',
      'modis-13A1-061': 'MODIS Vegetação',
      'modis-17A3HGF-061': 'MODIS Biomassa',
      'modis-11A1-061': 'MODIS Temperatura',
      'hgb': 'Biomassa Global',
      'esa-worldcover': 'ESA WorldCover'
    };
    return names[collection] || collection;
  };

  return (
    <div className="w-96 bg-card border-l border-border h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card">
        <h3 className="font-semibold text-foreground">
          {searchResults.length > 0 ? 'Imagens Encontradas' : 'Informações'}
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
                    {searchResults.length} {searchResults.length === 1 ? 'imagem encontrada' : 'imagens encontradas'}
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
                          {format(new Date(result.datetime), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {result.platform && (
                        <div className="text-xs text-muted-foreground">
                          Plataforma: {result.platform}
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
                  Desenhe uma área no mapa e clique em pesquisar para ver as imagens disponíveis
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
