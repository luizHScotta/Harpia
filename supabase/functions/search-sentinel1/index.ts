const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  aoi?: {
    type: string;
    coordinates: number[][][];
  };
  bbox?: number[]; // [lon_min, lat_min, lon_max, lat_max]
  startDate: string;
  endDate: string;
  maxResults?: number;
  collection?: string;
  municipality?: string; // Optional municipality ID for zonal statistics
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { aoi, bbox, startDate, endDate, maxResults = 20, collection = "sentinel-1-rtc", municipality }: SearchRequest = await req.json();

    console.log(`[REAL DATA] Searching Planetary Computer STAC API`);
    console.log(`Collection: ${collection}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    
    if (bbox) {
      console.log(`Using BBOX: [${bbox.join(', ')}]`);
    } else if (aoi) {
      console.log(`Using AOI polygon with ${aoi.coordinates[0].length} points`);
    }

    // Build CQL2-JSON filter for Planetary Computer STAC API
    const daterange = { interval: [startDate, endDate] };
    
    // Build spatial filter based on what's provided
    const spatialFilter = bbox 
      ? {
          op: "s_intersects",
          args: [
            { property: "geometry" }, 
            {
              type: "Polygon",
              coordinates: [[
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]]
              ]]
            }
          ]
        }
      : {
          op: "s_intersects",
          args: [{ property: "geometry" }, aoi]
        };
    
    const filter = {
      op: "and",
      args: [
        spatialFilter,
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
    
    console.log(`[REAL DATA] Found ${stacData.features?.length || 0} real Sentinel-1 scenes from Planetary Computer`);
    
    // Log first item details to verify real data
    if (stacData.features && stacData.features.length > 0) {
      const firstItem = stacData.features[0];
      console.log(`First item ID: ${firstItem.id}`);
      console.log(`Platform: ${firstItem.properties.platform}`);
      console.log(`Datetime: ${firstItem.properties.datetime}`);
      console.log(`Asset count: ${Object.keys(firstItem.assets || {}).length}`);
    }
    
    // If municipality ID provided, fetch municipality boundary for zonal stats
    let municipalityData = null;
    if (municipality) {
      try {
        const muniUrl = `https://servicodados.ibge.gov.br/api/v4/malhas/municipios/${municipality}?formato=application/vnd.geo%2Bjson&qualidade=minima`;
        const muniResponse = await fetch(muniUrl);
        if (muniResponse.ok) {
          municipalityData = await muniResponse.json();
          console.log(`Fetched municipality boundary for: ${municipality}`);
        }
      } catch (error) {
        console.error('Error fetching municipality boundary:', error);
      }
    }

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
        municipality: municipalityData,
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
