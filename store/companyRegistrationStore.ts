import { create } from "zustand";
import { EmployeeTable, AreaUnit, FuelUnit } from "@/types";

// ─── Step Data Shapes ─────────────────────────────────────────────────────────

export interface BasicInfoData {
  companyName: string;
  cinNumber: string;
  industryType: string;
  address: string;
  manufacturingUnitLocation: string;
  areaOfManufacturingUnit?: number;
  areaUnit?: AreaUnit;
}

export interface ResourcesData {
  totalWaterUsage_FY?: number;
  totalElectricityConsumption_FY?: number;
  totalFuelConsumption_FY?: number;
  fuelUnit?: FuelUnit;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultAgeGroup = () => ({ staff: 0, operations: 0, marketing: 0 });
const defaultGenderRow = () => ({
  age1830: defaultAgeGroup(),
  age3140: defaultAgeGroup(),
  age4150: defaultAgeGroup(),
  age5160: defaultAgeGroup(),
});
export const defaultEmployeeTable = (): EmployeeTable => ({
  male: defaultGenderRow(),
  female: defaultGenderRow(),
  transgender: defaultGenderRow(),
});

// ─── Store ────────────────────────────────────────────────────────────────────

interface CompanyRegistrationState {
  step: 1 | 2 | 3;

  // Step 1
  basicInfo: BasicInfoData | null;
  logoFile: File | null;          // NOT serialisable — in-memory only
  logoPreviewUrl: string | null;

  // Step 2
  resources: ResourcesData | null;

  // Step 3
  permanentEmployees: EmployeeTable;
  contractEmployees: EmployeeTable;

  // Actions
  setStep: (step: 1 | 2 | 3) => void;
  setBasicInfo: (data: BasicInfoData) => void;
  setLogo: (file: File, previewUrl: string) => void;
  clearLogo: () => void;
  setResources: (data: ResourcesData) => void;
  setPermanentEmployees: (table: EmployeeTable) => void;
  setContractEmployees: (table: EmployeeTable) => void;
  reset: () => void;
}

const initial = {
  step: 1 as const,
  basicInfo: null,
  logoFile: null,
  logoPreviewUrl: null,
  resources: null,
  permanentEmployees: defaultEmployeeTable(),
  contractEmployees: defaultEmployeeTable(),
};

export const useCompanyRegistrationStore = create<CompanyRegistrationState>((set) => ({
  ...initial,

  setStep: (step) => set({ step }),
  setBasicInfo: (data) => set({ basicInfo: data }),
  setLogo: (file, previewUrl) => set({ logoFile: file, logoPreviewUrl: previewUrl }),
  clearLogo: () => set({ logoFile: null, logoPreviewUrl: null }),
  setResources: (data) => set({ resources: data }),
  setPermanentEmployees: (table) => set({ permanentEmployees: table }),
  setContractEmployees: (table) => set({ contractEmployees: table }),
  reset: () => set(initial),
}));
