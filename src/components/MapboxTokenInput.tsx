import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TOKEN = "pk.eyJ1IjoidGFsaGFraHdqYTA2IiwiYSI6ImNsdTd60HptdTBhczgybGxsbWdmcjN6ZWwifQ.RBnwQKZHLwgUhnIh0LeP_g";

export const getMapboxToken = (): string => {
  const saved = localStorage.getItem("mapbox_token");
  return saved || DEFAULT_TOKEN;
};

export const MapboxTokenInput = () => {
  const [token, setToken] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setToken(getMapboxToken());
  }, []);

  const handleSave = () => {
    if (token.trim()) {
      localStorage.setItem("mapbox_token", token.trim());
      toast.success("Token do Mapbox salvo! Recarregue a página para aplicar.");
      setIsEditing(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem("mapbox_token");
    setToken(DEFAULT_TOKEN);
    toast.success("Token resetado para o padrão! Recarregue a página para aplicar.");
    setIsEditing(false);
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
        Configurar Token Mapbox
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-background/95 rounded-lg border">
      <label className="text-sm font-medium">Token do Mapbox</label>
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
