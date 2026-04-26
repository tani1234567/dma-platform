export interface IndustryCategory {
  label: string;
  types: string[];
}

const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    label: "Primary Industries",
    types: [
      "Agriculture",
      "Horticulture",
      "Plantation Crops",
      "Dairy Farming",
      "Poultry Farming",
      "Livestock Farming",
      "Fisheries",
      "Aquaculture",
      "Forestry",
      "Logging & Timber Extraction",
      "Mining (General)",
      "Coal Mining",
      "Metal Ore Mining",
      "Gold Mining",
      "Copper Mining",
      "Iron Ore Mining",
      "Rare Earth Mining",
      "Quarrying",
      "Stone & Sand Mining",
      "Oil Exploration",
      "Natural Gas Extraction",
      "Crude Oil Production",
      "Salt Extraction",
      "Peat Extraction",
    ],
  },
  {
    label: "Basic Materials",
    types: [
      "Steel Manufacturing",
      "Iron & Metal Processing",
      "Aluminium Production",
      "Copper Processing",
      "Cement Manufacturing",
      "Glass Manufacturing",
      "Ceramic Manufacturing",
      "Building Materials Manufacturing",
    ],
  },
  {
    label: "Chemical Industries",
    types: [
      "Petrochemicals",
      "Specialty Chemicals",
      "Agrochemicals",
      "Fertilizer Manufacturing",
      "Plastic & Polymer Manufacturing",
      "Rubber Manufacturing",
      "Paint & Coatings Manufacturing",
      "Adhesives & Sealants",
    ],
  },
  {
    label: "Energy Equipment",
    types: [
      "Power Equipment Manufacturing",
      "Solar Panel Manufacturing",
      "Wind Turbine Manufacturing",
      "Battery Manufacturing",
    ],
  },
  {
    label: "Machinery & Industrial Equipment",
    types: [
      "Industrial Machinery",
      "Construction Equipment Manufacturing",
      "Agricultural Machinery",
      "Electrical Equipment Manufacturing",
      "Transformers & Switchgear",
    ],
  },
  {
    label: "Automotive & Transport Equipment",
    types: [
      "Automobile Manufacturing",
      "Electric Vehicle Manufacturing",
      "Auto Components Manufacturing",
      "Shipbuilding",
      "Aircraft Manufacturing",
      "Railway Equipment Manufacturing",
    ],
  },
  {
    label: "Consumer Goods",
    types: [
      "Textile Manufacturing",
      "Garment Manufacturing",
      "Leather Goods Manufacturing",
      "Footwear Manufacturing",
      "Furniture Manufacturing",
    ],
  },
  {
    label: "Food & Beverage Processing",
    types: [
      "Food Processing",
      "Dairy Processing",
      "Beverage Manufacturing",
      "Sugar Manufacturing",
      "Edible Oil Processing",
      "Meat Processing",
      "Seafood Processing",
    ],
  },
  {
    label: "Pharmaceuticals & Healthcare Manufacturing",
    types: [
      "Pharmaceutical Manufacturing",
      "Biotechnology Manufacturing",
      "Medical Devices Manufacturing",
    ],
  },
  {
    label: "Electronics",
    types: [
      "Semiconductor Manufacturing",
      "Electronics Manufacturing",
      "Consumer Electronics Manufacturing",
    ],
  },
  {
    label: "Trade & Commerce",
    types: [
      "Wholesale Trade",
      "Retail Trade",
      "E-commerce",
    ],
  },
  {
    label: "Financial Services",
    types: [
      "Banking",
      "Insurance",
      "Investment Management",
      "Stock Exchanges",
      "FinTech Services",
    ],
  },
  {
    label: "Transport & Logistics",
    types: [
      "Road Transportation",
      "Rail Transportation",
      "Air Transportation",
      "Maritime Shipping",
      "Logistics & Warehousing",
      "Courier Services",
    ],
  },
  {
    label: "Hospitality & Tourism",
    types: [
      "Hotels",
      "Resorts",
      "Travel Agencies",
      "Tourism Services",
      "Event Management",
    ],
  },
  {
    label: "Healthcare Services",
    types: [
      "Hospitals",
      "Diagnostic Services",
      "Nursing Care Facilities",
      "Telemedicine Services",
    ],
  },
  {
    label: "Education",
    types: [
      "Schools",
      "Universities",
      "Vocational Training Institutes",
      "Online Education Platforms",
    ],
  },
  {
    label: "Media & Entertainment",
    types: [
      "Film Industry",
      "Television Broadcasting",
      "Digital Media",
      "Gaming Industry",
      "Music Industry",
    ],
  },
  {
    label: "Real Estate",
    types: [
      "Real Estate Development",
      "Property Management",
      "Facility Management",
    ],
  },
  {
    label: "Professional Services",
    types: [
      "Legal Services",
      "Accounting Services",
      "Consulting Services",
      "Marketing & Advertising",
      "Human Resource Services",
    ],
  },
  {
    label: "Knowledge & Technology",
    types: [
      "Information Technology Services",
      "Software Development",
      "Artificial Intelligence Development",
      "Cybersecurity Services",
      "Cloud Computing",
      "Big Data Analytics",
      "Research & Development Services",
      "Biotechnology Research",
      "Scientific Research Organizations",
      "Innovation Labs",
      "Technology Consulting",
      "Engineering Consulting",
    ],
  },
  {
    label: "Leadership & Governance",
    types: [
      "Government Administration",
      "Public Policy Institutions",
      "International Organizations",
      "Think Tanks",
      "Strategic Advisory Organizations",
      "Global Governance Bodies",
      "National Planning Commissions",
      "Top-Level Corporate Leadership",
      "Academic Research Leadership",
      "Public Sector Leadership",
    ],
  },
];

export default INDUSTRY_CATEGORIES;
