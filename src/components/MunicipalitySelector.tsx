import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";

interface Municipality {
  type: string;
  geometry: any;
  properties: {
    id: string;
    nome: string;
    microrregiao?: string;
    mesorregiao?: string;
  };
}

interface MunicipalitySelectorProps {
  onMunicipalitySelect: (municipality: Municipality) => void;
}

const MunicipalitySelector = ({ onMunicipalitySelect }: MunicipalitySelectorProps) => {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMuni, setSelectedMuni] = useState<string>("");

  useEffect(() => {
    fetchMunicipalities();
  }, []);

  const fetchMunicipalities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-ibge-municipalities', {
        body: { state: 'PA' } // Pará state
      });

      if (error) throw error;

      if (data.success) {
        setMunicipalities(data.data.features);
        console.log(`Loaded ${data.count} municipalities`);
      }
    } catch (error) {
      console.error('Error fetching municipalities:', error);
      toast.error('Erro ao carregar municípios', {
        description: 'Não foi possível carregar os municípios do IBGE'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (municipalityId: string) => {
    setSelectedMuni(municipalityId);
    const municipality = municipalities.find(m => m.properties.id === municipalityId);
    if (municipality) {
      onMunicipalitySelect(municipality);
      toast.success('Município selecionado', {
        description: municipality.properties.nome
      });
    }
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-card/95 backdrop-blur-sm p-4 rounded-lg border border-border shadow-elevated max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Selecionar Município</h3>
      </div>
      
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando municípios...
        </div>
      ) : (
        <Select value={selectedMuni} onValueChange={handleSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um município do Pará" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {municipalities.map((muni) => (
              <SelectItem key={muni.properties.id} value={muni.properties.id}>
                {muni.properties.nome}
                {muni.properties.microrregiao && (
                  <span className="text-xs text-muted-foreground ml-2">
                    - {muni.properties.microrregiao}
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default MunicipalitySelector;
