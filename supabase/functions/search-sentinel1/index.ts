const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  aoi: {
    type: string;
    coordinates: number[][][];
  };
  startDate?: string;
  endDate?: string;
  maxResults?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { aoi, startDate, endDate, maxResults = 10 }: SearchRequest = await req.json();

    console.log("Searching Sentinel-1 with AOI:", aoi);

    // Build CQL2-JSON filter for Planetary Computer STAC API
    const filter = {
      op: "and",
      args: [
        {
          op: "s_intersects",
          args: [{ property: "geometry" }, aoi]
        },
        {
          op: "=",
          args: [{ property: "collection" }, "sentinel-1-grd"]
        },
        {
          op: "in",
          args: [
            { property: "sar:polarizations" },
            [["VV", "VH"]]
          ]
        }
      ]
    };

    // Add date filter if provided
    if (startDate && endDate) {
      filter.args.push({
        op: "t_intersects",
        args: [
          { property: "datetime" },
          [startDate, endDate]
        ]
      } as any);
    }

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

    // Transform results to simpler format
    const results = stacData.features?.map((feature: any) => ({
      id: feature.id,
      datetime: feature.properties.datetime,
      geometry: feature.geometry,
      cloudCover: feature.properties["eo:cloud_cover"],
      polarizations: feature.properties["sar:polarizations"],
      platform: feature.properties.platform,
      constellation: feature.properties.constellation,
      instrumentMode: feature.properties["sar:instrument_mode"],
      productType: feature.properties["sar:product_type"],
      assets: feature.assets,
      bbox: feature.bbox
    })) || [];

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
