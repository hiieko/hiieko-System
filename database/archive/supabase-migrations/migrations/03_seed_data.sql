-- ====================================================================
-- Solar Site Management App — Seed Data & Demo Scenarios
-- Migration: 03_seed_data.sql
-- ====================================================================

-- 1. Demo Sites
INSERT INTO public.sites (id, name, code, address, latitude, longitude, geofence_radius_meters, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Parc Solar Craiova Sud', 'PV-CR-01', 'DJ552B, Craiova, Dolj', 44.2981, 23.8122, 350, true),
    ('22222222-2222-2222-2222-222222222222', 'Parc Solar Brașov Est', 'PV-BV-02', 'DN11, Hărman, Brașov', 45.7125, 25.6841, 400, true),
    ('33333333-3333-3333-3333-333333333333', 'Depozit Central Logistic', 'DEP-CENTRAL', 'Șos. Centurii 45, Ilfov', 44.4712, 26.0211, 200, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Demo Materials Catalog
INSERT INTO public.materials (id, code, name, unit, barcode, category, min_stock_threshold)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'PAN-550W', 'Panou Fotovoltaic Monocristalin 550W', 'buc', '5941234560012', 'Panouri Solare', 20),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CAB-SOL-6', 'Cablu Solar Negru 6mm²', 'm', '5941234560029', 'Cabluri & Conexiuni', 500),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'MC4-SET', 'Set Conectori MC4 Tata/Mama', 'set', '5941234560036', 'Cabluri & Conexiuni', 100),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'STR-ALU-PROF', 'Profil Aluminiu Structura 4.2m', 'buc', '5941234560043', 'Structura & Montaj', 30),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'GARD-150M', 'Gard Împrejmuire Șantier 150m', 'buc', '5941234560050', 'Protecție & Perimetru', 2),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'INV-100KW', 'Invertor Trifazat 100kW On-Grid', 'buc', '5941234560067', 'Invertoare', 2)
ON CONFLICT (code) DO NOTHING;
