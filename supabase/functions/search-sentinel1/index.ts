const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  aoi: {
    type: string;
    coordinates: number[][][];
  };
  startDate: string;
  endDate: string;
  maxResults?: number;
  collection?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { aoi, startDate, endDate, maxResults = 20, collection = "sentinel-1-rtc" }: SearchRequest = await req.json();

    console.log(`Searching ${collection} with AOI:`, aoi);
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Build CQL2-JSON filter for Planetary Computer STAC API
    const daterange = { interval: [startDate, endDate] };
    
    const filter = {
      op: "and",
      args: [
        {
          op: "s_intersects",
          args: [{ property: "geometry" }, aoi]
        },
        {
          op: "anyinteracts",
          args: [{ property: "datetime" }, daterange]
        },
        {
          op: "=",
          args: [{ property: "collection" }, collection]
        }
      ]
    };

    // Search Planetary Computer STAC API
    const stacUrl = "https://planetarycomputer.microsoft.com/api/stac/v1/search";
    const searchPayload = {
      filter_lang: "cql2-json",
      filter: filter,
      limit: maxResults
    };

    console.log("STAC search payload:", JSON.stringify(searchPayload, null, 2));

    const stacResponse = await fetch(stacUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchPayload)
    });

    if (!stacResponse.ok) {
      const errorText = await stacResponse.text();
      console.error("STAC API error:", errorText);
      throw new Error(`STAC API error: ${stacResponse.status} - ${errorText}`);
    }

    const stacData = await stacResponse.json();
    
    console.log(`Found ${stacData.features?.length || 0} Sentinel-1 scenes`);

    // Transform results to simpler format with all necessary data
    const results = stacData.features?.map((feature: any) => {
      // Get asset keys for easier access
      const assetKeys = Object.keys(feature.assets || {});
      
      return {
        id: feature.id,
        datetime: feature.properties.datetime,
        geometry: feature.geometry,
        cloudCover: feature.properties["eo:cloud_cover"],
        polarizations: feature.properties["sar:polarizations"],
        platform: feature.properties.platform,
        constellation: feature.properties.constellation,
        instrumentMode: feature.properties["sar:instrument_mode"],
        productType: feature.properties["sar:product_type"],
        collection: feature.collection,
        assets: feature.assets,
        assetKeys: assetKeys,
        bbox: feature.bbox,
        links: feature.links,
        stac_version: feature.stac_version,
        type: feature.type
      };
    }) || [];

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: results.length,
        results 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in search-sentinel1 function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
