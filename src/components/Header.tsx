import { Satellite, Download, Menu, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import nasaLogo from "@/assets/nasa-logo.png";
import harpiaLogo from "@/assets/harpia-logo.png";
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
  return <header className="h-20 bg-card border-b border-border flex items-center justify-between px-6 shadow-elevated">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hover:bg-muted">
          <Menu className="h-5 w-5" />
        </Button>
        <img src={nasaLogo} alt="NASA" className="h-10 w-10" />
        <div className="border-l border-border h-12 mx-2" />
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Through the Amazon Looking Glass
          </h1>
          <p className="text-sm text-muted-foreground italic">
            Explore the wonders and risks of the urban Amazon - Belém
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <img src={harpiaLogo} alt="Projeto Harpia" className="h-12 w-12" />
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Switch checked={isDark} onCheckedChange={checked => setTheme(checked ? "dark" : "light")} />
          <Moon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </header>;
};
export default Header;