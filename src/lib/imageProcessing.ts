/**
 * Image Processing Library for Satellite Data Analysis
 * Provides utilities for calculating spectral indices, thresholding, and statistics
 */

export interface BandData {
  data: Float32Array;
  width: number;
  height: number;
  nodata?: number;
}

export interface IndexResult {
  data: Float32Array;
  min: number;
  max: number;
  mean: number;
  stdDev: number;
}

/**
 * Convert Digital Number (DN) to reflectance
 */
export function dnToReflectance(dn: number, scale: number = 0.0001): number {
  return dn * scale;
}

/**
 * Convert linear backscatter to dB
 */
export function linearToDb(linear: number): number {
  return 10 * Math.log10(linear + 1e-9);
}

/**
 * Calculate NDWI (Normalized Difference Water Index)
 * NDWI = (Green - NIR) / (Green + NIR)
 */
export function calculateNDWI(green: BandData, nir: BandData): IndexResult {
  const length = green.data.length;
  const result = new Float32Array(length);
  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < length; i++) {
    const g = green.data[i];
    const n = nir.data[i];
    
    if (g === green.nodata || n === nir.nodata) {
      result[i] = NaN;
      continue;
    }

    const ndwi = (g - n) / (g + n + 1e-9);
    result[i] = ndwi;
    
    if (!isNaN(ndwi)) {
      sum += ndwi;
      count++;
      min = Math.min(min, ndwi);
      max = Math.max(max, ndwi);
    }
  }

  const mean = sum / count;
  let variance = 0;
  
  for (let i = 0; i < length; i++) {
    if (!isNaN(result[i])) {
      variance += Math.pow(result[i] - mean, 2);
    }
  }

  return {
    data: result,
    min,
    max,
    mean,
    stdDev: Math.sqrt(variance / count)
  };
}

/**
 * Calculate NDVI (Normalized Difference Vegetation Index)
 * NDVI = (NIR - Red) / (NIR + Red)
 */
export function calculateNDVI(nir: BandData, red: BandData): IndexResult {
  const length = nir.data.length;
  const result = new Float32Array(length);
  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < length; i++) {
    const n = nir.data[i];
    const r = red.data[i];
    
    if (n === nir.nodata || r === red.nodata) {
      result[i] = NaN;
      continue;
    }

    const ndvi = (n - r) / (n + r + 1e-9);
    result[i] = ndvi;
    
    if (!isNaN(ndvi)) {
      sum += ndvi;
      count++;
      min = Math.min(min, ndvi);
      max = Math.max(max, ndvi);
    }
  }

  const mean = sum / count;
  let variance = 0;
  
  for (let i = 0; i < length; i++) {
    if (!isNaN(result[i])) {
      variance += Math.pow(result[i] - mean, 2);
    }
  }

  return {
    data: result,
    min,
    max,
    mean,
    stdDev: Math.sqrt(variance / count)
  };
}

/**
 * Calculate NDMI (Normalized Difference Moisture Index)
 * NDMI = (NIR - SWIR) / (NIR + SWIR)
 */
export function calculateNDMI(nir: BandData, swir: BandData): IndexResult {
  const length = nir.data.length;
  const result = new Float32Array(length);
  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < length; i++) {
    const n = nir.data[i];
    const s = swir.data[i];
    
    if (n === nir.nodata || s === swir.nodata) {
      result[i] = NaN;
      continue;
    }

    const ndmi = (n - s) / (n + s + 1e-9);
    result[i] = ndmi;
    
    if (!isNaN(ndmi)) {
      sum += ndmi;
      count++;
      min = Math.min(min, ndmi);
      max = Math.max(max, ndmi);
    }
  }

  const mean = sum / count;
  let variance = 0;
  
  for (let i = 0; i < length; i++) {
    if (!isNaN(result[i])) {
      variance += Math.pow(result[i] - mean, 2);
    }
  }

  return {
    data: result,
    min,
    max,
    mean,
    stdDev: Math.sqrt(variance / count)
  };
}

/**
 * Apply threshold to index data
 */
export function applyThreshold(
  index: IndexResult,
  threshold: number,
  mode: 'above' | 'below' = 'above'
): Uint8Array {
  const length = index.data.length;
  const mask = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    const value = index.data[i];
    if (isNaN(value)) {
      mask[i] = 0;
    } else {
      mask[i] = mode === 'above' 
        ? (value > threshold ? 1 : 0)
        : (value < threshold ? 1 : 0);
    }
  }

  return mask;
}

/**
 * Calculate Otsu's threshold for automatic thresholding
 */
export function calculateOtsuThreshold(values: Float32Array): number {
  // Filter out NaN values
  const validValues = Array.from(values).filter(v => !isNaN(v));
  
  if (validValues.length === 0) return 0;

  // Create histogram (256 bins)
  const histogram = new Array(256).fill(0);
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min;

  for (const value of validValues) {
    const bin = Math.min(255, Math.floor(((value - min) / range) * 255));
    histogram[bin]++;
  }

  // Calculate Otsu's threshold
  const total = validValues.length;
  let sumTotal = 0;
  
  for (let i = 0; i < 256; i++) {
    sumTotal += i * histogram[i];
  }

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let i = 0; i < 256; i++) {
    weightBackground += histogram[i];
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += i * histogram[i];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;

    const variance = weightBackground * weightForeground * 
                    Math.pow(meanBackground - meanForeground, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  // Convert bin back to actual value
  return min + (threshold / 255) * range;
}

/**
 * Calculate area statistics for masked regions
 */
export function calculateMaskStatistics(mask: Uint8Array, pixelSize: number = 10): {
  pixelCount: number;
  area: number;
  percentage: number;
} {
  let pixelCount = 0;
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) pixelCount++;
  }

  const area = pixelCount * pixelSize * pixelSize; // m²
  const percentage = (pixelCount / mask.length) * 100;

  return {
    pixelCount,
    area,
    percentage
  };
}

/**
 * Colormap generation for visualization
 */
export function generateColormap(
  type: 'blues' | 'rdylgn' | 'viridis' | 'plasma'
): Array<[number, number, number]> {
  const colormaps: Record<string, Array<[number, number, number]>> = {
    blues: [
      [247, 251, 255],
      [222, 235, 247],
      [198, 219, 239],
      [158, 202, 225],
      [107, 174, 214],
      [66, 146, 198],
      [33, 113, 181],
      [8, 81, 156],
      [8, 48, 107]
    ],
    rdylgn: [
      [165, 0, 38],
      [215, 48, 39],
      [244, 109, 67],
      [253, 174, 97],
      [254, 224, 139],
      [255, 255, 191],
      [217, 239, 139],
      [166, 217, 106],
      [102, 189, 99],
      [26, 152, 80],
      [0, 104, 55]
    ],
    viridis: [
      [68, 1, 84],
      [72, 40, 120],
      [62, 73, 137],
      [49, 104, 142],
      [38, 130, 142],
      [31, 158, 137],
      [53, 183, 121],
      [109, 205, 89],
      [180, 222, 44],
      [253, 231, 37]
    ],
    plasma: [
      [13, 8, 135],
      [75, 3, 161],
      [125, 3, 168],
      [168, 34, 150],
      [203, 70, 121],
      [229, 107, 93],
      [248, 148, 65],
      [253, 195, 40],
      [240, 249, 33]
    ]
  };

  return colormaps[type];
}
