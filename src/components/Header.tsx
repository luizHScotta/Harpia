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
  return <header className="h-24 bg-gradient-to-r from-card via-card/95 to-card border-b-2 border-primary/20 flex items-center justify-between px-8 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="hover:bg-muted/50">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4 bg-background/80 px-4 py-2 rounded-xl border border-primary/20 shadow-lg">
          <img src={nasaLogo} alt="NASA" className="h-14 w-14 drop-shadow-lg" />
          <div className="border-l-2 border-primary/30 h-14 mx-2" />
          <img src={harpiaLogo} alt="Projeto Harpia" className="h-14 w-14 drop-shadow-lg" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight drop-shadow-sm">
            Through the Amazon Looking Glass
          </h1>
          <p className="text-sm text-muted-foreground italic font-medium">
            Explore the wonders and risks of the urban Amazon - Belém
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-background/80 px-4 py-2 rounded-xl border border-border shadow-md">
        <Sun className="h-4 w-4 text-muted-foreground" />
        <Switch checked={isDark} onCheckedChange={checked => setTheme(checked ? "dark" : "light")} />
        <Moon className="h-4 w-4 text-muted-foreground" />
      </div>
    </header>;
};
export default Header;