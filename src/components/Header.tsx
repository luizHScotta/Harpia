import { Menu, Sun, Moon, Settings, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import nasaLogo from "@/assets/nasa-logo.jpeg";
import projectLogo from "@/assets/project-logo.jpeg";

interface HeaderProps {
  onToggleSidebar: () => void;
  onExport: () => void;
  onToggleInfoPanel: () => void;
}

const Header = ({ onToggleSidebar, onExport, onToggleInfoPanel }: HeaderProps) => {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isDark = theme === "dark";

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
        <div className="flex items-center gap-2">
          <img src={nasaLogo} alt="NASA Logo" className="h-10 w-10 object-contain" />
          <img src={projectLogo} alt="Project Logo" className="h-10 w-10 object-contain" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("header.title")}
          </h1>
          <p className="text-xs text-muted-foreground">
            {t("header.subtitle")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleInfoPanel}
          title={t("header.toggleInfoPanel")}
          className="hover:bg-muted"
        >
          <PanelRightClose className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              {t("header.interface")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t("header.theme")}</DropdownMenuLabel>
            <div className="flex items-center justify-between px-2 py-2">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={isDark}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "dark" : "light")
                  }
                />
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("header.language")}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setLanguage("en")}>
              <span className={language === "en" ? "font-bold" : ""}>
                {t("header.english")}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage("pt")}>
              <span className={language === "pt" ? "font-bold" : ""}>
                {t("header.portuguese")}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
export default Header;