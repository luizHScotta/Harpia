import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmOTYzOTVkMC00ZTliLTQyODktOGFkMS0xMDM2OTE0NzBkOTQiLCJpZCI6MzQ3NTg0LCJpYXQiOjE3NTk3MTc2Mjh9.m6zd8j7fGT05GULQygW_VEewpjyrJn4w6rJFWNmP6vY";

export const getCesiumToken = (): string => {
  const saved = localStorage.getItem("cesium_token");
  return saved || DEFAULT_TOKEN;
};

export const CesiumTokenInput = () => {
  const [token, setToken] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setToken(getCesiumToken());
  }, []);

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem("cesium_token", token.trim());
      toast.success("Token salvo! Recarregando mapa...");
      setIsEditing(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleReset = () => {
    localStorage.removeItem("cesium_token");
    setToken(DEFAULT_TOKEN);
    toast.success("Token resetado! Recarregando mapa...");
    setIsEditing(false);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!isEditing) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="gap-2"
      >
        <Key className="h-4 w-4" />
        Configurar Token Cesium
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-background/95 rounded-lg border">
      <label className="text-sm font-medium">Token do Cesium</label>
      <Input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Cole seu token aqui"
        className="font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          Salvar
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset}>
          Resetar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
};
