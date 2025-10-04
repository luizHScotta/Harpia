const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DataRequest {
  itemId: string;
  collection: string;
  endpoint: 'bounds' | 'info' | 'assets' | 'statistics' | 'preview' | 'tiles' | 'bbox' | 'crop' | 'point';
  asset?: string;
  bounds?: number[];
  crop?: any;
  point?: [number, number];
  tileParams?: {
    z: number;
    x: number;
    y: number;
    asset?: string;
    rescale?: string;
    colormap?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, collection, endpoint, asset, bounds, crop, point, tileParams }: DataRequest = await req.json();

    console.log(`Fetching ${endpoint} for item ${itemId} from collection ${collection}`);

    const baseUrl = "https://planetarycomputer.microsoft.com/api/stac/v1";
    
    // Get the item details first
    const itemResponse = await fetch(`${baseUrl}/collections/${collection}/items/${itemId}`);
    
    if (!itemResponse.ok) {
      throw new Error(`Failed to fetch item: ${itemResponse.status}`);
    }

    const itemData = await itemResponse.json();
    
    // Sign the assets using Planetary Computer signing service
    const signResponse = await fetch('https://planetarycomputer.microsoft.com/api/sas/v1/sign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: [itemData] })
    });

    if (!signResponse.ok) {
      console.error('Failed to sign assets:', await signResponse.text());
      throw new Error(`Failed to sign assets: ${signResponse.status}`);
    }

    const signedData = await signResponse.json();
    const signedItem = signedData.items?.[0] || itemData;

    console.log('Item signed successfully');

    // Return different data based on endpoint
    switch (endpoint) {
      case 'bounds':
        return new Response(
          JSON.stringify({ 
            success: true, 
            bounds: signedItem.bbox,
            geometry: signedItem.geometry
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'info':
        return new Response(
          JSON.stringify({ 
            success: true, 
            info: {
              id: signedItem.id,
              collection: signedItem.collection,
              datetime: signedItem.properties.datetime,
              platform: signedItem.properties.platform,
              constellation: signedItem.properties.constellation,
              instrumentMode: signedItem.properties["sar:instrument_mode"],
              polarizations: signedItem.properties["sar:polarizations"],
              productType: signedItem.properties["sar:product_type"],
              processingLevel: signedItem.properties["processing:level"],
              bbox: signedItem.bbox,
              geometry: signedItem.geometry,
              properties: signedItem.properties
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'assets':
        const assetsList = Object.entries(signedItem.assets || {}).map(([key, value]: [string, any]) => ({
          key,
          title: value.title,
          type: value.type,
          roles: value.roles,
          href: value.href,
          hasStats: !!value['raster:bands']
        }));
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            assets: assetsList,
            fullAssets: signedItem.assets
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'statistics':
        if (!asset) {
          throw new Error('Asset parameter required for statistics');
        }
        
        const assetData = signedItem.assets[asset];
        if (!assetData) {
          throw new Error(`Asset ${asset} not found`);
        }

        // Use Titiler to get statistics
        const titilerUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/statistics`;
        const statsParams = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: asset,
          ...(bounds && { bbox: bounds.join(',') })
        });

        const statsResponse = await fetch(`${titilerUrl}?${statsParams}`);
        
        if (!statsResponse.ok) {
          const errorText = await statsResponse.text();
          console.error('Statistics error:', errorText);
          throw new Error(`Failed to get statistics: ${statsResponse.status}`);
        }

        const stats = await statsResponse.json();
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            statistics: stats
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'preview':
        // Get a preview PNG using Titiler
        const previewUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png`;
        const previewParams = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: asset || Object.keys(signedItem.assets)[0],
          rescale: '0,1000',
          width: '512',
          height: '512'
        });

        const previewResponse = await fetch(`${previewUrl}?${previewParams}`);
        
        if (!previewResponse.ok) {
          throw new Error(`Failed to get preview: ${previewResponse.status}`);
        }

        const previewBlob = await previewResponse.blob();
        const previewArrayBuffer = await previewBlob.arrayBuffer();
        
        return new Response(
          previewArrayBuffer,
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'image/png' 
            } 
          }
        );

      case 'tiles':
        if (!tileParams) {
          throw new Error('Tile parameters required');
        }

        // Build tile URL
        const tileUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/${tileParams.z}/${tileParams.x}/${tileParams.y}.png`;
        const tileParamsQuery = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: tileParams.asset || Object.keys(signedItem.assets)[0],
          ...(tileParams.rescale && { rescale: tileParams.rescale }),
          ...(tileParams.colormap && { colormap: tileParams.colormap })
        });

        const tileResponse = await fetch(`${tileUrl}?${tileParamsQuery}`);
        
        if (!tileResponse.ok) {
          throw new Error(`Failed to get tile: ${tileResponse.status}`);
        }

        const tileBlob = await tileResponse.blob();
        const tileArrayBuffer = await tileBlob.arrayBuffer();
        
        return new Response(
          tileArrayBuffer,
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=3600'
            } 
          }
        );

      case 'bbox':
        // Render a cropped area of the image using bounding box
        if (!bounds || bounds.length !== 4) {
          throw new Error('Valid bounds [minx, miny, maxx, maxy] required for bbox');
        }

        const bboxUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/${bounds.join(',')}.png`;
        const bboxParams = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: asset || Object.keys(signedItem.assets)[0],
          rescale: '0,1000',
          width: '512',
          height: '512'
        });

        const bboxResponse = await fetch(`${bboxUrl}?${bboxParams}`);
        
        if (!bboxResponse.ok) {
          throw new Error(`Failed to get bbox crop: ${bboxResponse.status}`);
        }

        const bboxBlob = await bboxResponse.blob();
        const bboxArrayBuffer = await bboxBlob.arrayBuffer();
        
        return new Response(
          bboxArrayBuffer,
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'image/png' 
            } 
          }
        );

      case 'crop':
        // Crop using GeoJSON geometry
        if (!crop) {
          throw new Error('GeoJSON crop geometry required');
        }

        const cropUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/crop`;
        const cropParams = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: asset || Object.keys(signedItem.assets)[0],
          rescale: '0,1000',
          width: '512',
          height: '512'
        });

        const cropResponse = await fetch(`${cropUrl}?${cropParams}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(crop)
        });
        
        if (!cropResponse.ok) {
          throw new Error(`Failed to crop: ${cropResponse.status}`);
        }

        const cropBlob = await cropResponse.blob();
        const cropArrayBuffer = await cropBlob.arrayBuffer();
        
        return new Response(
          cropArrayBuffer,
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'image/png' 
            } 
          }
        );

      case 'point':
        // Get pixel value at a specific point
        if (!point || point.length !== 2) {
          throw new Error('Valid point [lon, lat] required');
        }

        const pointUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/point/${point[0]},${point[1]}`;
        const pointParams = new URLSearchParams({
          collection: collection,
          item: itemId,
          assets: asset || Object.keys(signedItem.assets)[0]
        });

        const pointResponse = await fetch(`${pointUrl}?${pointParams}`);
        
        if (!pointResponse.ok) {
          throw new Error(`Failed to get point value: ${pointResponse.status}`);
        }

        const pointData = await pointResponse.json();
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            point: point,
            values: pointData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }

  } catch (error: any) {
    console.error('Error in get-sentinel1-data function:', error);
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
