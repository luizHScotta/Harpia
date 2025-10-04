import { Satellite, Download, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onToggleSidebar: () => void;
  onExport: () => void;
}

const Header = ({ onToggleSidebar, onExport }: HeaderProps) => {
  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shadow-elevated">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Satellite className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Portal de Monitoramento Geoespacial
          </h1>
          <p className="text-xs text-muted-foreground">
            Belém - Análise de Riscos Urbanos e Ambientais
          </p>
        </div>
      </div>
      <Button
        onClick={onExport}
        className="bg-primary hover:bg-primary/90 gap-2"
      >
        <Download className="h-4 w-4" />
        Exportar Relatório
      </Button>
    </header>
  );
};

export default Header;
