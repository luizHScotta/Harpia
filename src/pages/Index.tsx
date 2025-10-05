import { useState } from "react";
import { toast } from "sonner";
import Header from "@/components/Header";
import LayerControl, { defaultLayers, Layer } from "@/components/LayerControl";
import MapView from "@/components/MapView";
import InfoPanel from "@/components/InfoPanel";
import { useLanguage } from "@/contexts/LanguageContext";

const Index = () => {
  const { t, language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [layers, setLayers] = useState<Layer[]>(defaultLayers);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [currentAOI, setCurrentAOI] = useState<any>(null);
  const [handleSearch, setHandleSearch] = useState<(start: string, end: string) => Promise<void>>(() => async () => {});
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [onImageSelect, setOnImageSelect] = useState<((result: any, collection: string) => void) | undefined>();

  const handleLayerToggle = (id: string) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
      )
    );
  };

  const handleOpacityChange = (id: string, opacity: number) => {
    setLayers(prev =>
      prev.map(layer =>
        layer.id === id ? { ...layer, opacity } : layer
      )
    );
  };

  const handleClearAll = () => {
    setLayers(prev =>
      prev.map(layer => ({ ...layer, enabled: false }))
    );
    toast.success(t("layers.cleared"));
  };

  const handleFeatureClick = (data: any) => {
    setSelectedFeature(data);
    setInfoPanelOpen(true);
    toast.success(
      language === "pt" ? "Área selecionada" : "Area selected",
      {
        description: language === "pt" 
          ? `Carregando dados de ${data.name}`
          : `Loading data from ${data.name}`,
      }
    );
  };

  const handleAOIChange = (aoi: any) => {
    setCurrentAOI(aoi);
  };

  const handleSearchUpdate = (
    searchFn: (start: string, end: string) => Promise<void>, 
    searching: boolean,
    results?: any[],
    imageSelectFn?: (result: any, collection: string) => void
  ) => {
    setHandleSearch(() => searchFn);
    setIsSearching(searching);
    if (results) {
      setSearchResults(results);
      setInfoPanelOpen(true);
    }
    if (imageSelectFn) {
      setOnImageSelect(() => imageSelectFn);
    }
  };

  const handleExport = () => {
    toast.success(
      language === "pt" ? "Relatório em preparação" : "Report in preparation",
      {
        description: language === "pt" 
          ? "O download iniciará em instantes"
          : "Download will start shortly",
      }
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onExport={handleExport}
        onToggleInfoPanel={() => setInfoPanelOpen(!infoPanelOpen)}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Layer Controls */}
        {sidebarOpen && (
          <aside className="w-80 bg-card border-r border-border overflow-y-auto p-4">
            <LayerControl
              layers={layers}
              onLayerToggle={handleLayerToggle}
              onOpacityChange={handleOpacityChange}
              onClearAll={handleClearAll}
              aoi={currentAOI}
              onSearch={handleSearch}
              isSearching={isSearching}
            />
          </aside>
        )}

        {/* Map Container */}
        <main className="flex-1 relative">
          <MapView 
            layers={layers} 
            onFeatureClick={handleFeatureClick}
            onAOIChange={handleAOIChange}
            onSearchComplete={handleSearchUpdate}
          />
        </main>

        {/* Info Panel */}
        <InfoPanel 
          data={selectedFeature} 
          isOpen={infoPanelOpen}
          searchResults={searchResults}
          onImageSelect={onImageSelect}
        />
      </div>
    </div>
  );
};

export default Index;
