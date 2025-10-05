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
    
    "layers.title": "Data Layers",
    "layers.subtitle": "Select layers to display on the map",
    "layers.search.title": "Data Search",
    "layers.search.areaSet": "✓ Area of interest defined",
    "layers.search.drawArea": "Draw a polygon on the map to define the area of interest",
    "layers.search.opacity": "Opacity:",
    
    "layers.categories.sar": "SAR Data (Radar)",
    "layers.categories.optical": "Optical Data",
    "layers.categories.topography": "Topographic Data",
    "layers.categories.analysis": "Derived Products",
    "layers.categories.socioenvironmental": "Socio-environmental",
    
    "municipality.title": "Select Municipality",
    "municipality.loading": "Loading municipalities...",
    "municipality.placeholder": "Select a municipality from Pará",
    "municipality.selected": "Municipality selected",
    "municipality.error": "Error loading municipalities",
    "municipality.errorDescription": "Could not load municipalities from IBGE",
    
    "sentinel1.title": "Sentinel-1 Search",
    "sentinel1.collection": "Collection",
    "sentinel1.searchButton": "Search SAR Data",
    "sentinel1.results": "Results",
    "sentinel1.loadAll": "Load All",
    "sentinel1.noResults": "No scenes found",
    "sentinel1.clickToView": "Click to view on map",
    "sentinel1.assetsAvailable": "assets available",
    "sentinel1.scenesFound": "scenes found",
    "sentinel1.largeScenesFound": "scenes found (large area)",
    "sentinel1.largeScenesDescription": "Click 'Load All' to view the complete mosaic",
    "sentinel1.scenesDescription": "from",
    
    "planetary.title": "Planetary Computer Search",
    "planetary.collection": "Collection",
    "planetary.searchButton": "Search Data",
    "planetary.results": "Results",
    "planetary.loadAll": "Load All",
    "planetary.noResults": "No items found",
    "planetary.clickToView": "Click to view on map",
    "planetary.assetsAvailable": "assets available",
    "planetary.itemsFound": "items found",
    "planetary.clouds": "Clouds:",
    "planetary.loadingImages": "Loading images...",
    
    "common.search": "Search",
    "common.searching": "Searching...",
    "common.startDate": "Start Date",
    "common.endDate": "End Date",
    "common.defineArea": "Define an area of interest on the map",
    "common.defineAreaDescription": "Use the drawing tool to create a polygon",
    "common.to": "to",
    
    "info.availableImages": "Available Images",
    "info.noImages": "Draw an area on the map and click search to see available images",
    "info.satellite": "Satellite",
    "info.date": "Date",
    "info.polarizations": "Polarizations",
    "info.viewOnMap": "View on Map",
    "info.platform": "Platform",
    "info.imageFound": "image found",
    "info.imagesFound": "images found",
  },
  pt: {
    "header.title": "Portal de Monitoramento Geoespacial",
    "header.subtitle": "Belém - Análise de Riscos Urbanos e Ambientais",
    "header.interface": "Interface",
    "header.theme": "Tema",
    "header.language": "Idioma",
    "header.english": "Inglês",
    "header.portuguese": "Português",
    
    "layers.title": "Camadas de Dados",
    "layers.subtitle": "Selecione as camadas para visualizar no mapa",
    "layers.search.title": "Busca de Dados",
    "layers.search.areaSet": "✓ Área de interesse definida",
    "layers.search.drawArea": "Desenhe um polígono no mapa para definir a área de interesse",
    "layers.search.opacity": "Opacidade:",
    
    "layers.categories.sar": "Dados SAR (Radar)",
    "layers.categories.optical": "Dados Ópticos",
    "layers.categories.topography": "Dados Topográficos",
    "layers.categories.analysis": "Produtos Derivados",
    "layers.categories.socioenvironmental": "Socioambiental",
    
    "municipality.title": "Selecionar Município",
    "municipality.loading": "Carregando municípios...",
    "municipality.placeholder": "Selecione um município do Pará",
    "municipality.selected": "Município selecionado",
    "municipality.error": "Erro ao carregar municípios",
    "municipality.errorDescription": "Não foi possível carregar os municípios do IBGE",
    
    "sentinel1.title": "Busca Sentinel-1",
    "sentinel1.collection": "Coleção",
    "sentinel1.searchButton": "Buscar Dados SAR",
    "sentinel1.results": "Resultados",
    "sentinel1.loadAll": "Carregar Todas",
    "sentinel1.noResults": "Nenhuma cena encontrada",
    "sentinel1.clickToView": "Clique para visualizar no mapa",
    "sentinel1.assetsAvailable": "assets disponíveis",
    "sentinel1.scenesFound": "cenas encontradas",
    "sentinel1.largeScenesFound": "cenas encontradas (área grande)",
    "sentinel1.largeScenesDescription": "Clique em 'Carregar Todas' para visualizar o mosaico completo",
    "sentinel1.scenesDescription": "de",
    
    "planetary.title": "Busca Planetary Computer",
    "planetary.collection": "Coleção",
    "planetary.searchButton": "Buscar Dados",
    "planetary.results": "Resultados",
    "planetary.loadAll": "Carregar Todas",
    "planetary.noResults": "Nenhum item encontrado",
    "planetary.clickToView": "Clique para visualizar no mapa",
    "planetary.assetsAvailable": "assets disponíveis",
    "planetary.itemsFound": "itens encontrados",
    "planetary.clouds": "Nuvens:",
    "planetary.loadingImages": "Carregando imagens...",
    
    "common.search": "Pesquisar",
    "common.searching": "Buscando...",
    "common.startDate": "Data Inicial",
    "common.endDate": "Data Final",
    "common.defineArea": "Defina uma área de interesse no mapa",
    "common.defineAreaDescription": "Use a ferramenta de desenho para criar um polígono",
    "common.to": "a",
    
    "info.availableImages": "Imagens Disponíveis",
    "info.noImages": "Desenhe uma área no mapa e clique em pesquisar para ver as imagens disponíveis",
    "info.satellite": "Satélite",
    "info.date": "Data",
    "info.polarizations": "Polarizações",
    "info.viewOnMap": "Ver no Mapa",
    "info.platform": "Plataforma",
    "info.imageFound": "imagem encontrada",
    "info.imagesFound": "imagens encontradas",
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
