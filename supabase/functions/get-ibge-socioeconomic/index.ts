import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { municipioId } = await req.json();

    console.log('Fetching IBGE socioeconomic data for:', municipioId);

    // Pesquisa 37: Estimativas de população
    const populationUrl = `https://servicodados.ibge.gov.br/api/v1/pesquisas/37/periodos/all/indicadores/0/resultados/${municipioId}`;
    
    // Pesquisa 38: Produto Interno Bruto (PIB)
    const pibUrl = `https://servicodados.ibge.gov.br/api/v1/pesquisas/38/periodos/all/indicadores/0/resultados/${municipioId}`;
    
    // Pesquisa 60: Rendimento domiciliar per capita
    const rendimentoUrl = `https://servicodados.ibge.gov.br/api/v1/pesquisas/60/periodos/all/indicadores/0/resultados/${municipioId}`;
    
    // Pesquisa 1301: Domicílios com saneamento adequado
    const saneamentoUrl = `https://servicodados.ibge.gov.br/api/v1/pesquisas/1301/periodos/all/indicadores/0/resultados/${municipioId}`;
    
    // Pesquisa 6579: Índice de Desenvolvimento Humano Municipal (IDHM)
    const idhmUrl = `https://servicodados.ibge.gov.br/api/v1/pesquisas/6579/periodos/all/indicadores/0/resultados/${municipioId}`;

    // Fetch all data in parallel
    const [populationRes, pibRes, rendimentoRes, saneamentoRes, idhmRes] = await Promise.allSettled([
      fetch(populationUrl).then(r => r.ok ? r.json() : null),
      fetch(pibUrl).then(r => r.ok ? r.json() : null),
      fetch(rendimentoUrl).then(r => r.ok ? r.json() : null),
      fetch(saneamentoUrl).then(r => r.ok ? r.json() : null),
      fetch(idhmUrl).then(r => r.ok ? r.json() : null),
    ]);

    const extractLatestValue = (data: any) => {
      if (!data || !Array.isArray(data) || data.length === 0) return null;
      
      for (const indicator of data) {
        if (indicator.res && typeof indicator.res === 'object') {
          const periods = Object.keys(indicator.res).sort().reverse();
          for (const period of periods) {
            const value = indicator.res[period];
            if (value && value !== '...' && value !== '-' && value !== 'X') {
              return {
                value: parseFloat(value) || value,
                period,
                indicator: indicator.indicador
              };
            }
          }
        }
      }
      return null;
    };

    const socioeconomicData = {
      municipioId,
      population: populationRes.status === 'fulfilled' ? extractLatestValue(populationRes.value) : null,
      pib: pibRes.status === 'fulfilled' ? extractLatestValue(pibRes.value) : null,
      rendimento: rendimentoRes.status === 'fulfilled' ? extractLatestValue(rendimentoRes.value) : null,
      saneamento: saneamentoRes.status === 'fulfilled' ? extractLatestValue(saneamentoRes.value) : null,
      idhm: idhmRes.status === 'fulfilled' ? extractLatestValue(idhmRes.value) : null,
    };

    // Calcular índice de vulnerabilidade baseado nos dados
    let vulnerabilityScore = 0;
    let scoreComponents = [];

    if (socioeconomicData.rendimento?.value) {
      const rendimentoValue = parseFloat(socioeconomicData.rendimento.value);
      if (rendimentoValue < 1000) {
        vulnerabilityScore += 3;
        scoreComponents.push('Rendimento muito baixo');
      } else if (rendimentoValue < 2000) {
        vulnerabilityScore += 2;
        scoreComponents.push('Rendimento baixo');
      }
    }

    if (socioeconomicData.saneamento?.value) {
      const saneamentoValue = parseFloat(socioeconomicData.saneamento.value);
      if (saneamentoValue < 50) {
        vulnerabilityScore += 3;
        scoreComponents.push('Saneamento precário');
      } else if (saneamentoValue < 80) {
        vulnerabilityScore += 1;
        scoreComponents.push('Saneamento inadequado');
      }
    }

    if (socioeconomicData.idhm?.value) {
      const idhmValue = parseFloat(socioeconomicData.idhm.value);
      if (idhmValue < 0.6) {
        vulnerabilityScore += 3;
        scoreComponents.push('IDHM muito baixo');
      } else if (idhmValue < 0.7) {
        vulnerabilityScore += 2;
        scoreComponents.push('IDHM baixo');
      }
    }

    const vulnerabilityLevel = vulnerabilityScore >= 6 ? 'ALTA' : 
                              vulnerabilityScore >= 3 ? 'MÉDIA' : 'BAIXA';

    console.log('Socioeconomic data processed:', socioeconomicData);

    return new Response(
      JSON.stringify({
        success: true,
        data: socioeconomicData,
        vulnerability: {
          score: vulnerabilityScore,
          level: vulnerabilityLevel,
          components: scoreComponents
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('IBGE socioeconomic data error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
