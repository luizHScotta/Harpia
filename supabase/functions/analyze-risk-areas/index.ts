import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { aoi, layerData, searchResults, municipioId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Create Supabase client for calling other functions
    const supabaseClient = {
      functions: {
        invoke: async (functionName: string, options: any) => {
          const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
          const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
          
          const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options.body),
          });
          
          if (!response.ok) {
            const error = await response.text();
            return { data: null, error };
          }
          
          const data = await response.json();
          return { data, error: null };
        }
      }
    };

    // Fetch population and socioeconomic data if municipioId is provided
    let populationData = null;
    let socioeconomicData = null;
    
    if (municipioId) {
      console.log('Fetching population and socioeconomic data for municipality:', municipioId);
      try {
        const [popResult, socioResult] = await Promise.allSettled([
          supabaseClient.functions.invoke('get-ibge-population', {
            body: { municipioId }
          }),
          supabaseClient.functions.invoke('get-ibge-socioeconomic', {
            body: { municipioId }
          })
        ]);
        
        if (popResult.status === 'fulfilled' && !popResult.value.error) {
          populationData = popResult.value.data;
          console.log('Population data fetched successfully');
        } else {
          console.error('Error fetching population data:', popResult);
        }
        
        if (socioResult.status === 'fulfilled' && !socioResult.value.error) {
          socioeconomicData = socioResult.value.data;
          console.log('Socioeconomic data fetched successfully');
        } else {
          console.error('Error fetching socioeconomic data:', socioResult);
        }
      } catch (error) {
        console.error('Error invoking IBGE functions:', error);
      }
    }

    // Preparar contexto para análise
    const context = `
Analise os seguintes dados de sensoriamento remoto e identifique áreas de risco urbano com foco em vulnerabilidade social:

Área de Interesse (AOI): ${JSON.stringify(aoi)}

Dados de Camadas Ativas:
${JSON.stringify(layerData, null, 2)}

Resultados de Busca (últimas ${searchResults?.length || 0} imagens):
${JSON.stringify(searchResults?.slice(0, 5), null, 2)}

${populationData ? `
Dados Populacionais (IBGE):
${JSON.stringify(populationData, null, 2)}
` : ''}

${socioeconomicData ? `
Dados Socioeconômicos (IBGE):
- População: ${socioeconomicData.data?.population?.value || 'N/A'}
- PIB per capita: ${socioeconomicData.data?.pib?.value || 'N/A'}
- Rendimento domiciliar per capita: R$ ${socioeconomicData.data?.rendimento?.value || 'N/A'}
- Saneamento adequado: ${socioeconomicData.data?.saneamento?.value || 'N/A'}%
- IDHM: ${socioeconomicData.data?.idhm?.value || 'N/A'}
- Vulnerabilidade Social: ${socioeconomicData.vulnerability?.level || 'N/A'} (Score: ${socioeconomicData.vulnerability?.score || 0})
- Fatores de vulnerabilidade: ${socioeconomicData.vulnerability?.components?.join(', ') || 'N/A'}
` : ''}

Com base nesses dados, forneça uma análise TÉCNICA e ESTRUTURADA que OBRIGATORIAMENTE inclua:

## 1. GEORREFERENCIAMENTO DA VULNERABILIDADE HUMANA
- Análise de densidade populacional nas áreas de risco
- Identificação de grupos vulneráveis expostos (baixo rendimento, falta de saneamento, IDHM baixo)
- Relação entre áreas de inundação e concentração populacional
- Mapeamento de áreas periféricas e comunidades em situação de vulnerabilidade
- Infraestrutura crítica exposta (hospitais, escolas, estradas)

## 2. CLASSIFICAÇÃO DE RISCO POR CATEGORIAS
Crie uma TABELA com a seguinte estrutura:

| Setor | Extensão Inundação | Persistência | Exposição Social | Vulnerabilidade Socioeconômica | Ação Prioritária |
|-------|-------------------|--------------|------------------|-------------------------------|------------------|
| [Nome] | [Baixa/Média/Alta] | [dias] | [Baixa/Média/Alta] | [Rendimento/Saneamento/IDHM] | [Ação específica] |

## 3. INDICADORES-CHAVE PARA MONITORAMENTO
- % da AOI afetada por inundação
- Estimativa de domicílios expostos
- Tempo médio de persistência da água
- Distância das manchas a infraestruturas críticas (hospitais, escolas)
- Rendimento médio domiciliar nas áreas afetadas
- % de domicílios sem saneamento adequado
- IDHM médio das áreas de risco

## 4. ANÁLISE DE ÁREAS PERIFÉRICAS
- Identificação de bairros com baixo rendimento domiciliar (< R$ 1000/mês)
- Avaliação de condições de saneamento (< 50% adequado = crítico)
- Análise do IDHM (< 0.6 = muito baixo, 0.6-0.7 = baixo)
- Correlação entre vulnerabilidade social e exposição a riscos ambientais
- Destaque de comunidades em situação de ALTA vulnerabilidade

## 5. RECOMENDAÇÕES ACIONÁVEIS
Para cada área de risco, forneça recomendações PRÁTICAS como:
- **Infraestrutura Verde**: Pavimento permeável em vias locais específicas
- **Drenagem**: Bacias de retenção comunitárias em praças identificadas
- **Construções**: Telhados verdes em prédios públicos (escolas, postos de saúde)
- **Saneamento**: Melhorias urgentes em sistemas de esgoto e água
- **Habitação**: Programas de reassentamento para áreas de altíssimo risco
- **Social**: Assistência social para famílias em situação de vulnerabilidade
- Localização exata das intervenções prioritárias com coordenadas

## 6. INTEGRAÇÃO COM ALERTAS CLIMÁTICOS
- Necessidade de sistemas de monitoramento (INMET, CEMADEN, radar meteorológico)
- Proposta de sistema de alerta precoce específico para comunidades vulneráveis
- Combinação de previsão meteorológica com histórico de inundação
- Sistema de comunicação em tempo real para áreas periféricas
- Centros de acolhimento temporário em locais seguros

## 7. ANÁLISE TEMPORAL
- Identificação de tendências entre os períodos disponíveis
- Áreas com persistência crônica de inundação (> 10 dias)
- Evolução da extensão das áreas afetadas
- Mudanças nos indicadores socioeconômicos ao longo do tempo
- Correlação entre eventos climáticos e impactos sociais

## 8. PRIORIZAÇÃO URGENTE
Liste as TOP 3 áreas que necessitam intervenção IMEDIATA com:
- **Localização**: Coordenadas e nome do setor
- **Risco Ambiental**: Tipo e intensidade (inundação, erosão, etc.)
- **População Afetada**: Número estimado de famílias
- **Vulnerabilidade Social**: Rendimento, saneamento, IDHM
- **Infraestrutura Crítica**: Hospitais, escolas próximas
- **Ação Prioritária**: Intervenção específica necessária
- **Prazo**: Urgência (imediato, curto, médio prazo)
- **Custo-Benefício**: Estimativa simplificada

IMPORTANTE: Forneça uma análise VISUAL e ESTRUTURADA com tabelas, listas numeradas e seções claras. Use dados REAIS dos indicadores socioeconômicos fornecidos.
`;

    console.log('Enviando requisição para Lovable AI...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de risco geoespacial e sensoriamento remoto, com foco em áreas urbanas vulneráveis e vulnerabilidade social. Forneça análises técnicas estruturadas com tabelas, indicadores quantitativos e recomendações práticas acionáveis. Use markdown para formatação com tabelas, listas e seções bem definidas. Priorize clareza visual e organização hierárquica da informação.'
          },
          {
            role: 'user',
            content: context
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 402) {
        throw new Error('Payment required. Please add credits to your workspace.');
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('Análise concluída com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-risk-areas:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
