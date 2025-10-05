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
    const { aoi, startDate, endDate, collection, maxResults = 50, skipDateFilter = false } = await req.json();
    
    console.log("🔍 Searching Planetary Computer:", { collection, startDate, endDate, skipDateFilter });

    // Build STAC search request
    const searchBody: any = {
      collections: [collection],
      intersects: aoi,
      limit: maxResults,
      sortby: [{ field: "properties.datetime", direction: "desc" }]
    };

    // Skip datetime filter for static collections like DEM
    if (!skipDateFilter && startDate && endDate) {
      searchBody.datetime = `${startDate}/${endDate}`;
    }

    // Planetary Computer STAC API
    const response = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("STAC API error:", errorText);
      throw new Error(`STAC API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.features?.length || 0} items`);

    // Transform results
    const results = data.features.map((feature: any) => ({
      id: feature.id,
      datetime: feature.properties.datetime,
      geometry: feature.geometry,
      bbox: feature.bbox,
      collection: feature.collection,
      assets: feature.assets,
      properties: feature.properties,
      platform: feature.properties['platform'] || feature.properties['eo:platform'] || collection,
      cloudCover: feature.properties['eo:cloud_cover'],
      assetKeys: Object.keys(feature.assets)
    }));

    return new Response(
      JSON.stringify({
        success: true,
        results,
        count: results.length,
        totalFeatures: data.numberMatched || results.length
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error("❌ Error:", error);
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
