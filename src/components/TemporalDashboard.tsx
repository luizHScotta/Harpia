import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Download, Calendar, Minimize2, Maximize2 } from "lucide-react";

interface HistoricalData {
  year: number;
  [key: string]: number;
}

const COVER_TYPES = [
  { key: 'Water', label: 'Água', color: 'hsl(210 85% 50%)' },
  { key: 'Trees', label: 'Árvores', color: 'hsl(95 70% 45%)' },
  { key: 'Flooded Vegetation', label: 'Vegetação Alagada', color: 'hsl(180 65% 45%)' },
  { key: 'Crops', label: 'Culturas', color: 'hsl(50 85% 55%)' },
  { key: 'Built Area', label: 'Área Construída', color: 'hsl(0 72% 51%)' },
  { key: 'Rangeland', label: 'Pastagem', color: 'hsl(40 75% 60%)' }
];

const TemporalDashboard = () => {
  const [data, setData] = useState<HistoricalData[]>([]);
  const [selectedYear, setSelectedYear] = useState([2024]);
  const [isLoading, setIsLoading] = useState(true);
  const [trends, setTrends] = useState<Record<string, number>>({});
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    loadHistoricalData();
  }, []);

  const loadHistoricalData = async () => {
    try {
      const { data: rawData, error } = await supabase
        .from('land_cover_history')
        .select('*')
        .order('year');

      if (error) throw error;

      // Transform data for chart
      const groupedByYear: Record<number, any> = {};
      
      rawData?.forEach((row: any) => {
        if (!groupedByYear[row.year]) {
          groupedByYear[row.year] = { year: row.year };
        }
        groupedByYear[row.year][row.land_cover_type] = row.percentage;
      });

      const chartData = Object.values(groupedByYear);
      setData(chartData);

      // Calculate trends (change from first to last year)
      if (chartData.length >= 2) {
        const firstYear = chartData[0];
        const lastYear = chartData[chartData.length - 1];
        const calculatedTrends: Record<string, number> = {};

        COVER_TYPES.forEach(({ key }) => {
          const change = ((lastYear[key] - firstYear[key]) / firstYear[key]) * 100;
          calculatedTrends[key] = change;
        });

        setTrends(calculatedTrends);
      }

    } catch (error: any) {
      console.error('Erro ao carregar dados históricos:', error);
      toast.error('Erro ao carregar dados históricos');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = () => {
    const selectedYearData = data.find(d => d.year === selectedYear[0]);
    if (!selectedYearData) return;

    const report = `
Relatório de Cobertura do Solo - Belém
Ano: ${selectedYear[0]}

${COVER_TYPES.map(({ key, label }) => {
  const value = selectedYearData[key] || 0;
  const trend = trends[key] || 0;
  const trendSymbol = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  return `${label}: ${value.toFixed(2)}% ${trendSymbol} ${Math.abs(trend).toFixed(1)}%`;
}).join('\n')}

Gerado em: ${new Date().toLocaleString('pt-BR')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-cobertura-${selectedYear[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Relatório exportado');
  };

  if (isLoading) {
    return (
      <Card className="absolute bottom-4 left-4 w-[600px] shadow-elevated">
        <CardContent className="p-6 text-center">
          <p>Carregando dados históricos...</p>
        </CardContent>
      </Card>
    );
  }

  const selectedYearData = data.find(d => d.year === selectedYear[0]);

  return (
    <Card className="absolute bottom-4 left-4 w-[600px] max-h-[500px] overflow-y-auto shadow-elevated">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Análise Temporal (2017-2024)
            </CardTitle>
            <CardDescription>
              Evolução da cobertura do solo em Belém
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="space-y-4">
        {/* Year Slider */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Ano: {selectedYear[0]}</Label>
            <Button size="sm" variant="outline" onClick={exportReport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
          <Slider
            value={selectedYear}
            onValueChange={setSelectedYear}
            min={2017}
            max={2024}
            step={1}
            className="w-full"
          />
        </div>

        {/* Line Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {COVER_TYPES.map(({ key, label, color }) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics for Selected Year */}
        {selectedYearData && (
          <div className="grid grid-cols-2 gap-2">
            {COVER_TYPES.map(({ key, label, color }) => {
              const value = selectedYearData[key] || 0;
              const trend = trends[key] || 0;
              const isPositive = trend > 0;

              return (
                <Card key={key} className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold" style={{ color }}>
                        {value.toFixed(2)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {isPositive ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {Math.abs(trend).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Key Insights */}
        <div className="bg-muted p-3 rounded-md space-y-1">
          <p className="text-sm font-medium">Principais Mudanças:</p>
          <ul className="text-xs space-y-1 text-muted-foreground">
            <li>🏗️ Área construída cresceu {Math.abs(trends['Built Area'] || 0).toFixed(1)}%</li>
            <li>🌳 Cobertura de árvores variou {Math.abs(trends['Trees'] || 0).toFixed(1)}%</li>
            <li>💧 Corpos d'água permaneceram estáveis (~36%)</li>
          </ul>
        </div>
      </CardContent>
      )}
    </Card>
  );
};

export default TemporalDashboard;
