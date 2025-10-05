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
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Preparar contexto para análise
    const context = `
Analise os seguintes dados de sensoriamento remoto e identifique áreas de risco:

Área de Interesse (AOI): ${JSON.stringify(aoi)}

Dados de Camadas Ativas:
${JSON.stringify(layerData, null, 2)}

Resultados de Busca (últimas ${searchResults?.length || 0} imagens):
${JSON.stringify(searchResults?.slice(0, 5), null, 2)}

Com base nesses dados, forneça uma análise detalhada que inclua:
1. Identificação de áreas de alto risco (inundação, deslizamento, erosão)
2. Razões específicas para cada área de risco identificada
3. Recomendações para mitigação de risco
4. Análise temporal se dados históricos estiverem disponíveis
5. Priorização de áreas que necessitam intervenção urgente
`;

    console.log('Enviando requisição para OpenAI...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de risco geoespacial e sensoriamento remoto, com foco em áreas urbanas vulneráveis. Forneça análises técnicas detalhadas mas acessíveis.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
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
