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
    const { bbox, date, layers } = await req.json();
    const NASA_API_KEY = Deno.env.get('NASA_API_KEY');

    if (!NASA_API_KEY) {
      throw new Error('NASA_API_KEY not configured');
    }

    console.log('Fetching NASA World View data:', { bbox, date, layers });

    // NASA GIBS (Global Imagery Browse Services) endpoint
    const layerString = layers || 'MODIS_Terra_CorrectedReflectance_TrueColor';
    const width = 512;
    const height = 512;

    // Construct WMTS URL for NASA GIBS
    const wmtsUrl = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/${layerString}/default/${date}/250m/{z}/{y}/{x}.jpg`;

    // Also fetch available imagery metadata
    const metadataUrl = `https://api.nasa.gov/planetary/earth/assets?lon=${(bbox[0] + bbox[2]) / 2}&lat=${(bbox[1] + bbox[3]) / 2}&date=${date}&dim=0.15&api_key=${NASA_API_KEY}`;

    const metadataResponse = await fetch(metadataUrl);
    const metadata = metadataResponse.ok ? await metadataResponse.json() : null;

    console.log('NASA metadata:', metadata);

    return new Response(
      JSON.stringify({
        success: true,
        wmtsUrl,
        metadata,
        layers: layerString,
        date,
        bbox
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('NASA World View error:', error);
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
