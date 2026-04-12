/**
 * 200+ NIC 2008-based industry types for the company registration dropdown.
 * Stored as plain strings in Firestore (industryType field).
 */

export const INDUSTRY_TYPES: string[] = [
  // ─── Agriculture & Allied Activities ───────────────────────────────────────
  "Agriculture – Crop Production (Paddy, Wheat, Pulses)",
  "Agriculture – Plantation (Tea, Coffee, Rubber, Spices)",
  "Agriculture – Animal Husbandry (Dairy, Poultry, Livestock)",
  "Agriculture – Fisheries and Aquaculture",
  "Agriculture – Horticulture and Vegetables",
  "Agriculture – Floriculture",
  "Agriculture – Sericulture (Silk)",
  "Forestry and Logging",
  "Agricultural Support Services",

  // ─── Mining & Quarrying ────────────────────────────────────────────────────
  "Mining – Coal and Lignite",
  "Mining – Crude Petroleum Extraction",
  "Mining – Natural Gas Extraction",
  "Mining – Iron Ore",
  "Mining – Manganese Ore",
  "Mining – Bauxite (Aluminium Ore)",
  "Mining – Copper Ore",
  "Mining – Zinc and Lead Ore",
  "Mining – Chromite",
  "Quarrying – Limestone and Dolomite",
  "Quarrying – Granite and Marble",
  "Quarrying – Sand, Gravel and Stone",
  "Other Mining and Quarrying",

  // ─── Food & Beverage Manufacturing ────────────────────────────────────────
  "Food Manufacturing – Grain Milling (Rice, Flour, Dal)",
  "Food Manufacturing – Sugar and Jaggery",
  "Food Manufacturing – Confectionery and Bakery",
  "Food Manufacturing – Edible Oils Refining",
  "Food Manufacturing – Dairy Products",
  "Food Manufacturing – Meat and Poultry Processing",
  "Food Manufacturing – Fish and Seafood Processing",
  "Food Manufacturing – Fruit and Vegetable Processing",
  "Food Manufacturing – Spices, Condiments and Masala",
  "Food Manufacturing – Tea and Coffee Processing",
  "Food Manufacturing – Packaged and Ready-to-Eat Foods",
  "Food Manufacturing – Starch and Starch Products",
  "Food Manufacturing – Animal Feed",
  "Beverages – Alcoholic (Beer, Wine, Spirits)",
  "Beverages – Non-Alcoholic (Soft Drinks, Juices, Water)",

  // ─── Tobacco ──────────────────────────────────────────────────────────────
  "Tobacco Products Manufacturing",

  // ─── Textiles & Apparel ────────────────────────────────────────────────────
  "Textiles – Cotton Yarn Spinning",
  "Textiles – Synthetic and Man-Made Fibre",
  "Textiles – Blended Yarn",
  "Textiles – Weaving (Cotton Fabrics)",
  "Textiles – Weaving (Synthetic and Blended Fabrics)",
  "Textiles – Processing, Dyeing and Finishing",
  "Textiles – Knitting and Hosiery",
  "Textiles – Technical Textiles (Geotextiles, Medical, etc.)",
  "Textiles – Jute and Jute Products",
  "Textiles – Silk Weaving",
  "Textiles – Woollen Products",
  "Textiles – Carpets and Rugs",
  "Garment and Apparel Manufacturing",
  "Home Textiles and Furnishings",

  // ─── Leather & Footwear ───────────────────────────────────────────────────
  "Leather – Tanning and Dressing",
  "Leather Goods Manufacturing (Bags, Belts, Wallets)",
  "Footwear Manufacturing",

  // ─── Wood & Furniture ─────────────────────────────────────────────────────
  "Wood Products – Sawmilling and Planing",
  "Wood Products – Plywood and Laminates",
  "Wood Products – Particle Board and MDF",
  "Furniture Manufacturing (Wood)",
  "Furniture Manufacturing (Metal, Plastic)",

  // ─── Paper & Packaging ────────────────────────────────────────────────────
  "Paper and Paperboard Manufacturing",
  "Corrugated Boxes and Packaging",
  "Printed Packaging and Labels",
  "Printing and Publishing",

  // ─── Chemicals & Petrochemicals ───────────────────────────────────────────
  "Chemicals – Basic Organic (Benzene, Ethylene, etc.)",
  "Chemicals – Basic Inorganic (Acids, Alkalis, Salts)",
  "Chemicals – Fertilisers (Urea, DAP, NPK)",
  "Chemicals – Agrochemicals and Pesticides",
  "Chemicals – Paints, Varnishes and Coatings",
  "Chemicals – Soaps, Detergents and Surfactants",
  "Chemicals – Adhesives and Sealants",
  "Chemicals – Dyes and Pigments",
  "Chemicals – Specialty and Fine Chemicals",
  "Chemicals – Industrial Gases",
  "Petrochemicals – Crude Oil Refining",
  "Petrochemicals – Polymers and Resins",
  "Petrochemicals – Lubricants and Greases",
  "Chemicals – Water Treatment",
  "Chemicals – Cosmetics and Personal Care",

  // ─── Pharmaceuticals & Life Sciences ──────────────────────────────────────
  "Pharmaceuticals – Active Pharmaceutical Ingredients (API)",
  "Pharmaceuticals – Formulations (Tablets, Capsules, Injectables)",
  "Pharmaceuticals – Biopharmaceuticals and Vaccines",
  "Pharmaceuticals – Veterinary Medicines",
  "Pharmaceuticals – Herbal and Ayurvedic",
  "Medical Devices Manufacturing",
  "Surgical Instruments and Implants",
  "Diagnostics and In-Vitro Diagnostics",
  "Nutraceuticals and Dietary Supplements",

  // ─── Rubber & Plastics ────────────────────────────────────────────────────
  "Rubber – Tyre and Tube Manufacturing",
  "Rubber Goods (Non-Tyre: Belts, Hoses, Seals)",
  "Plastics – Pipes, Fittings and Profiles",
  "Plastics – Packaging Films and Sheets",
  "Plastics – Moulded Consumer Products",
  "Plastics – Geomembranes and Technical Films",
  "Composite Materials and Fibreglass",

  // ─── Non-Metallic Mineral Products ────────────────────────────────────────
  "Cement Manufacturing",
  "Ready-Mix Concrete",
  "Ceramic and Porcelain Products",
  "Glass and Glass Products",
  "Firebricks and Refractories",
  "Tiles and Sanitary Ware",
  "Gypsum Products (Plasterboard, etc.)",
  "Stone Processing (Granite, Marble, Slate)",
  "Abrasives Manufacturing",

  // ─── Iron, Steel & Basic Metals ───────────────────────────────────────────
  "Iron and Steel – Integrated Steel Plants (BF-BOF)",
  "Iron and Steel – Mini Steel Plants (EAF/Induction)",
  "Iron and Steel – Stainless Steel",
  "Iron and Steel – Special Alloy Steels",
  "Aluminium Smelting and Rolling",
  "Copper Smelting and Fabrication",
  "Zinc and Lead Smelting",
  "Ferro Alloys Manufacturing",
  "Metal Casting and Foundry",
  "Wire Drawing and Cable Manufacturing",
  "Seamless Pipes and Tubes",
  "ERW Pipes and Hollow Sections",

  // ─── Fabricated Metal Products ────────────────────────────────────────────
  "Fabricated Metal – Structural Steel Fabrication",
  "Fabricated Metal – Pressure Vessels and Boilers",
  "Fabricated Metal – Metal Stampings and Forgings",
  "Fabricated Metal – Springs and Wire Products",
  "Fabricated Metal – Fasteners (Nuts, Bolts, Screws)",
  "Fabricated Metal – Hand Tools and Hardware",
  "Fabricated Metal – Cans, Containers and Drums",
  "Fabricated Metal – Metal Furniture and Shelving",

  // ─── Electronics & IT Hardware ────────────────────────────────────────────
  "Electronics – Consumer Electronics",
  "Electronics – Industrial and Process Control",
  "Electronics – Semiconductor and Components",
  "Electronics – PCB Assembly and EMS",
  "Electronics – Telecom Equipment",
  "Electronics – LED Lighting and Luminaires",
  "Electronics – Solar PV Modules and Inverters",
  "Electronics – Security and Surveillance Systems",
  "Electronics – Defence Electronics",

  // ─── Electrical Equipment ─────────────────────────────────────────────────
  "Electrical – Power Transformers",
  "Electrical – Electric Motors and Generators",
  "Electrical – Switchgear and Control Panels",
  "Electrical – Cables and Wires",
  "Electrical – Batteries and Energy Storage",
  "Electrical – Power Electronics (UPS, Drives, Inverters)",
  "Electrical – Metering and Instrumentation",
  "Electrical – Home Appliances",

  // ─── Machinery & Industrial Equipment ─────────────────────────────────────
  "Machinery – Agricultural (Tractors, Harvesters)",
  "Machinery – Mining and Construction Equipment",
  "Machinery – Textile Machinery",
  "Machinery – Food Processing Machinery",
  "Machinery – Machine Tools and CNC",
  "Machinery – Material Handling (Cranes, Conveyors)",
  "Machinery – Pumps and Compressors",
  "Machinery – Valves and Flow Control",
  "Machinery – HVAC and Refrigeration",
  "Machinery – Printing and Packaging Machinery",
  "Machinery – General Industrial Equipment",
  "Machinery – Oil and Gas Equipment",

  // ─── Automobiles & Transport Equipment ────────────────────────────────────
  "Automotive – Passenger Cars",
  "Automotive – Commercial Vehicles (Trucks, Buses)",
  "Automotive – Two and Three Wheelers",
  "Automotive – Tractors and Farm Equipment",
  "Automotive – Auto Components (Engine, Transmission)",
  "Automotive – Auto Components (Body, Chassis, Interiors)",
  "Automotive – Electric Vehicles",
  "Automotive – Auto Components (Brakes, Steering, Suspension)",
  "Railways – Coaches and Wagons",
  "Shipbuilding and Marine",
  "Aerospace Components and MRO",

  // ─── Other Manufacturing ──────────────────────────────────────────────────
  "Jewellery and Precious Metals",
  "Toys, Games and Sports Goods",
  "Musical Instruments",
  "Stationery and Office Supplies",
  "Candles and Incense Sticks",
  "Matches and Firelighters",
  "Defence Ordnance and Ammunition",

  // ─── Utilities ────────────────────────────────────────────────────────────
  "Power Generation – Thermal (Coal, Gas, Oil)",
  "Power Generation – Hydro",
  "Power Generation – Nuclear",
  "Power Generation – Solar",
  "Power Generation – Wind",
  "Power Generation – Biomass and Waste-to-Energy",
  "Electricity Transmission and Distribution",
  "Water Treatment and Supply",
  "Sewage Treatment",
  "Waste Collection and Disposal",
  "Waste Recycling and Recovery",

  // ─── Construction ─────────────────────────────────────────────────────────
  "Construction – Residential Buildings",
  "Construction – Commercial and Office Buildings",
  "Construction – Industrial Plants and Factories",
  "Construction – Roads and Highways",
  "Construction – Railways and Metro",
  "Construction – Ports and Airports",
  "Construction – Power and Pipeline Infrastructure",
  "Construction – Dams and Irrigation",
  "Specialised Construction and EPC",

  // ─── Trade & Commerce ─────────────────────────────────────────────────────
  "Wholesale – Agricultural Commodities",
  "Wholesale – Industrial and Mining Products",
  "Wholesale – Consumer Goods",
  "Retail – General Merchandise (Supermarkets, Hypermarkets)",
  "Retail – Speciality (Electronics, Apparel, Pharmacy)",
  "Retail – E-Commerce",
  "Automobile Dealerships and Service",

  // ─── Transport & Logistics ────────────────────────────────────────────────
  "Transport – Road Freight",
  "Transport – Passenger (Buses, Taxis)",
  "Transport – Railway (Freight and Passenger)",
  "Transport – Aviation (Airlines, Airports)",
  "Transport – Shipping and Inland Waterways",
  "Warehousing and Cold Chain",
  "Courier and Express Delivery",
  "Port Operations and Stevedoring",
  "Logistics and Third-Party Logistics (3PL)",
  "Pipeline Transport (Oil, Gas)",

  // ─── Information & Communication Technology ───────────────────────────────
  "IT – Software Development and Products",
  "IT – IT-Enabled Services (ITES/BPO/KPO)",
  "IT – Cloud Computing and Data Centres",
  "IT – Cybersecurity Services",
  "IT – Data Analytics and Artificial Intelligence",
  "Telecom – Mobile and Fixed-Line Services",
  "Telecom – Internet Service Provider",
  "IT – E-Commerce Platform and Marketplace",
  "IT – Fintech and Digital Payments",
  "IT – Health Tech and Ed Tech",
  "Broadcasting and Media",

  // ─── Financial Services ───────────────────────────────────────────────────
  "Financial – Commercial Banking",
  "Financial – Non-Banking Financial Company (NBFC)",
  "Financial – Insurance (Life)",
  "Financial – Insurance (General)",
  "Financial – Capital Markets and Stock Broking",
  "Financial – Asset Management and Mutual Funds",
  "Financial – Microfinance",
  "Financial – Payment Systems and Wallets",

  // ─── Real Estate & Infrastructure ─────────────────────────────────────────
  "Real Estate – Residential Development",
  "Real Estate – Commercial and Retail Spaces",
  "Real Estate – Industrial Parks and SEZ",
  "Real Estate – Township and Integrated Development",
  "Facilities Management",

  // ─── Professional & Business Services ─────────────────────────────────────
  "Professional – Legal Services",
  "Professional – Accounting and Audit",
  "Professional – Management Consulting",
  "Professional – Engineering and Technical Consulting",
  "Professional – Research and Development",
  "Advertising, Marketing and PR",
  "Staffing and Human Resources",

  // ─── Healthcare & Social Services ─────────────────────────────────────────
  "Healthcare – Hospitals and Clinics",
  "Healthcare – Diagnostics and Pathology Labs",
  "Healthcare – Retail Pharmacy",
  "Healthcare – Medical Tourism",
  "Healthcare – Health Insurance (TPA)",

  // ─── Education ────────────────────────────────────────────────────────────
  "Education – K-12 Schools",
  "Education – Higher Education (Colleges and Universities)",
  "Education – Vocational and Technical Training",
  "Education – EdTech and Online Learning",

  // ─── Hospitality & Tourism ────────────────────────────────────────────────
  "Hospitality – Hotels and Resorts",
  "Hospitality – Restaurants and Food Service",
  "Hospitality – Travel Agencies and Tour Operators",
  "Hospitality – Event Management",

  // ─── Other Services ───────────────────────────────────────────────────────
  "Repair and Maintenance Services",
  "Laundry and Dry-Cleaning Services",
  "Security and Investigation Services",
  "Waste Water Treatment Services",
  "Other Services",
];

export default INDUSTRY_TYPES;
