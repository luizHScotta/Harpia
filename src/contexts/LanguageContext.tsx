import { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "pt";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  en: {
    "header.title": "Geospatial Monitoring Portal",
    "header.subtitle": "Belém - Urban and Environmental Risk Analysis",
    "header.interface": "Interface",
    "header.theme": "Theme",
    "header.language": "Language",
    "header.english": "English",
    "header.portuguese": "Portuguese",
    "layer.sentinel1": "Sentinel-1 SAR",
    "layer.planetary": "Planetary Computer",
    "search.dateRange": "Date Range",
    "search.startDate": "Start Date",
    "search.endDate": "End Date",
    "search.button": "Search Images",
    "search.searching": "Searching...",
    "info.availableImages": "Available Images",
    "info.noImages": "Draw an area on the map and click search to see available images",
    "info.satellite": "Satellite",
    "info.date": "Date",
    "info.polarizations": "Polarizations",
    "info.viewOnMap": "View on Map",
  },
  pt: {
    "header.title": "Portal de Monitoramento Geoespacial",
    "header.subtitle": "Belém - Análise de Riscos Urbanos e Ambientais",
    "header.interface": "Interface",
    "header.theme": "Tema",
    "header.language": "Idioma",
    "header.english": "Inglês",
    "header.portuguese": "Português",
    "layer.sentinel1": "Sentinel-1 SAR",
    "layer.planetary": "Planetary Computer",
    "search.dateRange": "Período",
    "search.startDate": "Data Inicial",
    "search.endDate": "Data Final",
    "search.button": "Buscar Imagens",
    "search.searching": "Buscando...",
    "info.availableImages": "Imagens Disponíveis",
    "info.noImages": "Desenhe uma área no mapa e clique em pesquisar para ver as imagens disponíveis",
    "info.satellite": "Satélite",
    "info.date": "Data",
    "info.polarizations": "Polarizações",
    "info.viewOnMap": "Ver no Mapa",
  },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
