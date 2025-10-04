import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { state } = await req.json();
    
    // Default to Pará (PA) if no state specified
    const stateCode = state || 'PA';
    
    console.log(`Fetching municipalities for state: ${stateCode}`);
    
    // Fetch municipality boundaries from IBGE API in GeoJSON format
    const ibgeUrl = `https://servicodados.ibge.gov.br/api/v4/malhas/estados/${stateCode}?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=minima`;
    
    const response = await fetch(ibgeUrl);
    
    if (!response.ok) {
      throw new Error(`IBGE API error: ${response.status} ${response.statusText}`);
    }
    
    const geoJson = await response.json();
    
    console.log(`Successfully fetched ${geoJson.features?.length || 0} municipalities`);
    
    // Enhance features with metadata from IBGE localities API
    const municipalitiesWithMetadata = await Promise.all(
      geoJson.features.map(async (feature: any) => {
        try {
          // Extract municipality code from properties (varies by IBGE API version)
          const municipioId = feature.properties?.codarea || 
                             feature.properties?.geocodigo || 
                             feature.id;
          
          if (municipioId) {
            // Fetch additional metadata
            const metaUrl = `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${municipioId}`;
            const metaResponse = await fetch(metaUrl);
            
            if (metaResponse.ok) {
              const metadata = await metaResponse.json();
              feature.properties = {
                ...feature.properties,
                id: municipioId,
                nome: metadata.nome,
                microrregiao: metadata.microrregiao?.nome,
                mesorregiao: metadata.mesorregiao?.nome,
                regiao: metadata.microrregiao?.mesorregiao?.UF?.regiao?.nome,
              };
            }
          }
        } catch (error) {
          console.error(`Error fetching metadata for feature:`, error);
        }
        
        return feature;
      })
    );
    
    geoJson.features = municipalitiesWithMetadata;
    
    return new Response(
      JSON.stringify({
        success: true,
        data: geoJson,
        state: stateCode,
        count: geoJson.features.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
    
  } catch (error) {
    console.error('Error in get-ibge-municipalities:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
