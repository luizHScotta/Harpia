-- Create table for historical land cover data
CREATE TABLE IF NOT EXISTS public.land_cover_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  land_cover_type TEXT NOT NULL,
  year INT NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  region TEXT DEFAULT 'Belém',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(land_cover_type, year, region)
);

-- Enable RLS
ALTER TABLE public.land_cover_history ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view historical data)
CREATE POLICY "Allow public read access" 
ON public.land_cover_history 
FOR SELECT 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_land_cover_year ON public.land_cover_history(year);
CREATE INDEX idx_land_cover_type ON public.land_cover_history(land_cover_type);

-- Insert historical data from CSV
INSERT INTO public.land_cover_history (land_cover_type, year, percentage) VALUES
('Water', 2017, 36.35),
('Water', 2018, 36.36),
('Water', 2019, 36.35),
('Water', 2020, 36.35),
('Water', 2021, 36.36),
('Water', 2022, 36.34),
('Water', 2023, 36.33),
('Water', 2024, 36.30),
('Trees', 2017, 46.98),
('Trees', 2018, 47.87),
('Trees', 2019, 48.42),
('Trees', 2020, 47.70),
('Trees', 2021, 48.63),
('Trees', 2022, 47.92),
('Trees', 2023, 48.10),
('Trees', 2024, 47.20),
('Flooded Vegetation', 2017, 0.02),
('Flooded Vegetation', 2018, 0.03),
('Flooded Vegetation', 2019, 0.03),
('Flooded Vegetation', 2020, 0.02),
('Flooded Vegetation', 2021, 0.02),
('Flooded Vegetation', 2022, 0.04),
('Flooded Vegetation', 2023, 0.02),
('Flooded Vegetation', 2024, 0.02),
('Crops', 2017, 0.78),
('Crops', 2018, 0.52),
('Crops', 2019, 0.34),
('Crops', 2020, 0.60),
('Crops', 2021, 0.31),
('Crops', 2022, 0.49),
('Crops', 2023, 0.31),
('Crops', 2024, 0.71),
('Built Area', 2017, 9.51),
('Built Area', 2018, 9.34),
('Built Area', 2019, 9.12),
('Built Area', 2020, 9.56),
('Built Area', 2021, 9.16),
('Built Area', 2022, 9.55),
('Built Area', 2023, 9.70),
('Built Area', 2024, 10.10),
('Bare Ground', 2017, 0.09),
('Bare Ground', 2018, 0.06),
('Bare Ground', 2019, 0.05),
('Bare Ground', 2020, 0.05),
('Bare Ground', 2021, 0.04),
('Bare Ground', 2022, 0.04),
('Bare Ground', 2023, 0.04),
('Bare Ground', 2024, 0.04),
('Rangeland', 2017, 6.27),
('Rangeland', 2018, 5.80),
('Rangeland', 2019, 5.60),
('Rangeland', 2020, 5.71),
('Rangeland', 2021, 5.36),
('Rangeland', 2022, 5.60),
('Rangeland', 2023, 5.47),
('Rangeland', 2024, 5.62);
