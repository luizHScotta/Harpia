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
    const { bbox, startDate, endDate, cloudCover = 20 } = await req.json();
    const OBSERVEARTH_API_KEY = Deno.env.get('OBSERVEARTH_API_KEY');

    if (!OBSERVEARTH_API_KEY) {
      throw new Error('OBSERVEARTH_API_KEY not configured');
    }

    console.log('Fetching ObserveEarth data:', { bbox, startDate, endDate, cloudCover });

    // ObserveEarth API endpoint for satellite imagery
    // Format: [west, south, east, north]
    const searchUrl = `https://api.observearth.com/v1/imagery/search`;
    
    const searchParams = {
      bbox: bbox,
      datetime: `${startDate}/${endDate}`,
      limit: 20,
      collections: ['sentinel-2-l2a', 'landsat-8-l2', 'landsat-9-l2'],
      query: {
        'eo:cloud_cover': {
          lte: cloudCover
        }
      }
    };

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OBSERVEARTH_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(searchParams)
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('ObserveEarth API error:', errorText);
      throw new Error(`ObserveEarth API error: ${searchResponse.status}`);
    }

    const data = await searchResponse.json();
    
    console.log('ObserveEarth results:', {
      count: data.features?.length || 0,
      collections: [...new Set(data.features?.map((f: any) => f.collection) || [])]
    });

    // Transform results to include preview URLs and metadata
    const results = data.features?.map((feature: any) => ({
      id: feature.id,
      collection: feature.collection,
      datetime: feature.properties.datetime,
      cloudCover: feature.properties['eo:cloud_cover'],
      thumbnail: feature.assets?.thumbnail?.href,
      preview: feature.assets?.visual?.href,
      bbox: feature.bbox,
      geometry: feature.geometry,
      assets: feature.assets
    })) || [];

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        results,
        bbox,
        dateRange: { startDate, endDate }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('ObserveEarth error:', error);
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
