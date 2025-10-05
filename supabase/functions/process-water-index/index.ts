import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexRequest {
  aoi: any;
  startDate: string;
  endDate: string;
  collection: string;
  indexType: 'ndwi' | 'ndvi' | 'ndmi' | 'sar-water' | 'false-color';
  threshold?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { aoi, startDate, endDate, collection, indexType, threshold = 0.2 } = await req.json() as IndexRequest;
    
    console.log(`🔍 Processing ${indexType} for collection ${collection}`);

    // Build STAC search request
    const searchBody = {
      collections: [collection],
      intersects: aoi,
      datetime: `${startDate}/${endDate}`,
      limit: 10,
      sortby: [{ field: "properties.datetime", direction: "desc" }],
      query: {
        "eo:cloud_cover": collection === "sentinel-2-l2a" ? { lt: 30 } : undefined
      }
    };

    // Search Planetary Computer STAC API
    const response = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      throw new Error(`STAC API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.features?.length || 0} items`);

    // Process each item and generate tile URLs
    const processedResults = data.features.map((feature: any) => {
      const itemId = feature.id;
      const bbox = feature.bbox;
      
      // Generate expression based on index type
      let expression = '';
      let colormap = '';
      let rescale = '';
      
      if (indexType === 'ndwi') {
        // NDWI = (Green - NIR) / (Green + NIR)
        expression = '(b03-b08)/(b03+b08)';
        colormap = 'blues';
        rescale = '-1,1';
      } else if (indexType === 'ndvi') {
        // NDVI = (NIR - Red) / (NIR + Red)
        expression = '(b08-b04)/(b08+b04)';
        colormap = 'rdylgn';
        rescale = '-1,1';
      } else if (indexType === 'ndmi') {
        // NDMI = (NIR - SWIR) / (NIR + SWIR)
        expression = '(b08-b11)/(b08+b11)';
        colormap = 'gist_earth_r';
        rescale = '-1,1';
      } else if (indexType === 'false-color') {
        // False Color IR: NIR, Red, Green
        expression = 'b08,b04,b03';
        rescale = '0,3000';
      } else if (indexType === 'sar-water') {
        // SAR backscatter in dB
        expression = '10*log10(vv)';
        colormap = 'viridis';
        rescale = '-25,-5';
      }

      // Generate Titiler URL for rendering
      const baseUrl = 'https://planetarycomputer.microsoft.com/api/data/v1';
      const tileUrl = `${baseUrl}/item/tiles/{z}/{x}/{y}?collection=${collection}&item=${itemId}${expression ? `&expression=${expression}` : ''}${colormap ? `&colormap_name=${colormap}` : ''}${rescale ? `&rescale=${rescale}` : ''}`;
      
      // Calculate statistics
      const stats = {
        cloudCover: feature.properties['eo:cloud_cover'] || 0,
        datetime: feature.properties.datetime,
        platform: feature.properties['platform'] || collection
      };

      return {
        id: itemId,
        datetime: feature.properties.datetime,
        geometry: feature.geometry,
        bbox,
        collection,
        indexType,
        tileUrl,
        threshold,
        stats,
        assets: feature.assets,
        properties: feature.properties
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        results: processedResults,
        count: processedResults.length,
        indexType,
        threshold
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
