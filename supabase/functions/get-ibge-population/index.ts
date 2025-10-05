import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { municipioId } = await req.json();
    
    console.log("🔍 Buscando dados populacionais do IBGE para município:", municipioId);

    // Buscar população estimada (Pesquisa 37 - Estimativas da População)
    const populacaoResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/pesquisas/37/periodos/all/indicadores/0/resultados/${municipioId}`
    );

    if (!populacaoResponse.ok) {
      throw new Error(`Erro ao buscar população: ${populacaoResponse.status}`);
    }

    const populacaoData = await populacaoResponse.json();
    
    // Buscar dados do município (nome, área)
    const municipioResponse = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipioId}`
    );

    if (!municipioResponse.ok) {
      throw new Error(`Erro ao buscar dados do município: ${municipioResponse.status}`);
    }

    const municipioData = await municipioResponse.json();

    // Processar dados de população
    let populacaoTotal = 0;
    let anoMaisRecente = "";
    
    if (populacaoData && populacaoData.length > 0) {
      const resultado = populacaoData[0];
      if (resultado.res) {
        const periodos = Object.keys(resultado.res);
        if (periodos.length > 0) {
          anoMaisRecente = periodos[periodos.length - 1];
          populacaoTotal = parseInt(resultado.res[anoMaisRecente]) || 0;
        }
      }
    }

    // Calcular densidade populacional
    const area = municipioData.area?.total || 0;
    const densidadePopulacional = area > 0 ? parseFloat((populacaoTotal / area).toFixed(2)) : 0;

    const resultado = {
      success: true,
      municipio: {
        id: municipioData.id,
        nome: municipioData.nome,
        microrregiao: municipioData.microrregiao?.nome,
        mesorregiao: municipioData.microrregiao?.mesorregiao?.nome,
        uf: municipioData.microrregiao?.mesorregiao?.UF?.sigla,
      },
      populacao: {
        total: populacaoTotal,
        ano: anoMaisRecente,
        densidadePorKm2: densidadePopulacional,
        area: area,
      },
      vulnerabilidade: {
        nivel: densidadePopulacional > 1000 ? "alta" : densidadePopulacional > 500 ? "média" : "baixa",
        risco: densidadePopulacional > 1000 ? 
          "Alta concentração populacional - Risco elevado em caso de inundação" :
          densidadePopulacional > 500 ?
          "Concentração populacional moderada - Risco médio" :
          "Baixa concentração populacional - Risco reduzido"
      }
    };

    console.log("✅ Dados do IBGE obtidos com sucesso");

    return new Response(
      JSON.stringify(resultado),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error("❌ Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Unknown error'
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        status: 500
      }
    );
  }
});
