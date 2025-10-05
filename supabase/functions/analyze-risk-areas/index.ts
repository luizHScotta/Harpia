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
    const { aoi, layerData, searchResults } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Preparar contexto para análise
    const context = `
Analise os seguintes dados de sensoriamento remoto e identifique áreas de risco urbano com foco em vulnerabilidade social:

Área de Interesse (AOI): ${JSON.stringify(aoi)}

Dados de Camadas Ativas:
${JSON.stringify(layerData, null, 2)}

Resultados de Busca (últimas ${searchResults?.length || 0} imagens):
${JSON.stringify(searchResults?.slice(0, 5), null, 2)}

Dados Populacionais (se disponíveis):
${JSON.stringify(searchResults?.populationData, null, 2)}

Com base nesses dados, forneça uma análise TÉCNICA e ESTRUTURADA que OBRIGATORIAMENTE inclua:

## 1. GEORREFERENCIAMENTO DA VULNERABILIDADE HUMANA
- Análise de densidade populacional nas áreas de risco
- Identificação de grupos vulneráveis expostos
- Relação entre áreas de inundação e concentração populacional

## 2. CLASSIFICAÇÃO DE RISCO POR CATEGORIAS
Crie uma TABELA com a seguinte estrutura:

| Setor | Extensão Inundação | Persistência | Exposição Social | Ação Prioritária |
|-------|-------------------|--------------|------------------|------------------|
| [Nome] | [Baixa/Média/Alta] | [dias] | [Baixa/Média/Alta + infraestrutura] | [Ação específica] |

## 3. INDICADORES-CHAVE PARA MONITORAMENTO
- % da AOI afetada por inundação
- Estimativa de domicílios expostos
- Tempo médio de persistência da água
- Distância das manchas a infraestruturas críticas (hospitais, escolas)

## 4. RECOMENDAÇÕES ACIONÁVEIS
Para cada área de risco, forneça recomendações PRÁTICAS como:
- Pavimento permeável em vias locais específicas
- Bacias de retenção comunitárias em praças identificadas
- Telhados verdes em prédios públicos
- Localização exata das intervenções prioritárias

## 5. INTEGRAÇÃO COM ALERTAS CLIMÁTICOS
- Necessidade de sistemas de monitoramento (INMET, CEMADEN)
- Proposta de sistema de alerta precoce
- Combinação de previsão meteorológica com histórico de inundação

## 6. ANÁLISE TEMPORAL
- Identificação de tendências entre os períodos disponíveis
- Áreas com persistência crônica de inundação
- Evolução da extensão das áreas afetadas

## 7. PRIORIZAÇÃO URGENTE
Liste as TOP 3 áreas que necessitam intervenção IMEDIATA com:
- Justificativa técnica
- Risco estimado (população + infraestrutura)
- Ação prioritária específica
- Prazo sugerido para intervenção

IMPORTANTE: Forneça uma análise VISUAL e ESTRUTURADA com tabelas, listas numeradas e seções claras.
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
