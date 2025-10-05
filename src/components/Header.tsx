import { Satellite, Download, Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
interface HeaderProps {
  onToggleSidebar: () => void;
  onExport: () => void;
}
const Header = ({
  onToggleSidebar,
  onExport
}: HeaderProps) => {
  const {
    theme,
    setTheme
  } = useTheme();
  const isDark = theme === "dark";
  return <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 shadow-elevated">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hover:bg-muted">
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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Switch checked={isDark} onCheckedChange={checked => setTheme(checked ? "dark" : "light")} />
          <Moon className="h-4 w-4 text-muted-foreground" />
        </div>
        
      </div>
    </header>;
};
export default Header;