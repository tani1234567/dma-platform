import { create } from "zustand";
import { Assessment, AssessmentStatus, Stakeholder } from "@/types";

interface AssessmentWizardState {
  // Current assessment being created/edited
  currentAssessmentId: string | null;
  financialYear: string;
  status: AssessmentStatus;

  // Wizard step
  currentStep: number;
  totalSteps: number;

  // Stakeholders
  stakeholders: Stakeholder[];

  // Actions
  setCurrentAssessmentId: (id: string | null) => void;
  setFinancialYear: (fy: string) => void;
  setStatus: (status: AssessmentStatus) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setStakeholders: (stakeholders: Stakeholder[]) => void;
  addStakeholder: (stakeholder: Stakeholder) => void;
  removeStakeholder: (id: string) => void;
  reset: () => void;
}

const initialState = {
  currentAssessmentId: null,
  financialYear: "",
  status: AssessmentStatus.DRAFT,
  currentStep: 1,
  totalSteps: 5,
  stakeholders: [],
};

export const useAssessmentStore = create<AssessmentWizardState>((set, get) => ({
  ...initialState,

  setCurrentAssessmentId: (id) => set({ currentAssessmentId: id }),
  setFinancialYear: (fy) => set({ financialYear: fy }),
  setStatus: (status) => set({ status }),
  setCurrentStep: (step) => set({ currentStep: step }),
  nextStep: () => {
    const { currentStep, totalSteps } = get();
    if (currentStep < totalSteps) set({ currentStep: currentStep + 1 });
  },
  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) set({ currentStep: currentStep - 1 });
  },
  setStakeholders: (stakeholders) => set({ stakeholders }),
  addStakeholder: (stakeholder) =>
    set((state) => ({ stakeholders: [...state.stakeholders, stakeholder] })),
  removeStakeholder: (id) =>
    set((state) => ({ stakeholders: state.stakeholders.filter((s) => s.id !== id) })),
  reset: () => set(initialState),
}));
