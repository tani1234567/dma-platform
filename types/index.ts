import { Timestamp } from "firebase/firestore";

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  COMPANY_ADMIN = "company_admin",
  FIELD_AGENT = "field_agent",
}

export enum IndustryType {
  MANUFACTURING = "manufacturing",
  FINANCIAL_SERVICES = "financial_services",
  TECHNOLOGY = "technology",
  HEALTHCARE = "healthcare",
  ENERGY = "energy",
  RETAIL = "retail",
  CONSTRUCTION = "construction",
  AGRICULTURE = "agriculture",
  TRANSPORT = "transport",
  OTHER = "other",
}

export enum StakeholderType {
  MANAGEMENT = "Management",
  EMPLOYEES = "Employees",
  CUSTOMERS = "Customers",
  SUPPLIERS = "Suppliers",
  COMMUNITY = "Community",
  INVESTORS = "Investors",
  EXPERTS_NGOS = "Experts/NGOs",
}

export enum AssessmentStatus {
  DRAFT = "draft",
  STAKEHOLDER_SURVEY = "stakeholder_survey",
  SCORING = "scoring",
  REVIEW = "review",
  COMPLETED = "completed",
}

export enum SurveyTokenStatus {
  PENDING = "pending",
  SENT = "sent",
  OPENED = "opened",
  COMPLETED = "completed",
  EXPIRED = "expired",
}

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  companyId?: string;
  photoURL?: string;
  jobTitle?: string;
  phone?: string;
  registrationComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Employee Grid Types ──────────────────────────────────────────────────────

export interface EmployeeAgeGroup {
  staff: number;
  operations: number;
  marketing: number;
}

export interface EmployeeGenderRow {
  age1830: EmployeeAgeGroup;
  age3140: EmployeeAgeGroup;
  age4150: EmployeeAgeGroup;
  age5160: EmployeeAgeGroup;
}

export interface EmployeeTable {
  male: EmployeeGenderRow;
  female: EmployeeGenderRow;
  transgender: EmployeeGenderRow;
}

export type AreaUnit = "sqm" | "acres" | "sqft";
export type FuelUnit = "litres" | "GJ";

// ─── Company ──────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  adminUid: string;
  status: "active" | "suspended";

  // Step 1 — Basic Info
  name: string;
  cinNumber: string;
  industry: string;                   // free string from 200+ industry types
  address: string;
  country: string;
  manufacturingUnitLocation: string;
  areaOfManufacturingUnit?: number;
  areaUnit?: AreaUnit;
  logoURL?: string;

  // Step 2 — Resource Consumption (Last FY)
  totalWaterUsage_FY?: number;
  totalElectricityConsumption_FY?: number;
  totalFuelConsumption_FY?: number;
  fuelUnit?: FuelUnit;

  // Step 3 — Employee Data
  permanentEmployees?: EmployeeTable;
  contractEmployees?: EmployeeTable;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Assessment {
  id: string;
  companyId: string;
  financialYear: string;
  status: AssessmentStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  stakeholderCount?: number;
  responseCount?: number;
  selectedTopics?: string[];
  stakeholderWeightages?: Record<string, number>;
  surveyLinkExpiryDays?: number;
  launchedAt?: Timestamp;
}

export interface Stakeholder {
  id: string;
  companyId: string;
  assessmentId: string;
  name: string;
  email: string;
  type: StakeholderType;
  weight: number;
  surveyToken: string;
  surveyLink?: string;
  tokenExpiresAt: Timestamp;
  status: SurveyTokenStatus;
  reminderCount: number;
  isProxySubmission: boolean;
  assignedTopics?: string[];
  organisation?: string;
  emailSentAt?: Timestamp;
  lastReminderAt?: Timestamp;
  submittedAt?: Timestamp;
  proxyAgentUid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SurveyToken {
  id: string;
  stakeholderId: string;
  companyId: string;
  assessmentId: string;
  email: string;
  status: SurveyTokenStatus;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface TopicRating {
  impact: number;       // 1-5
  financial: number;    // 1-5
  comment?: string;
}

export interface SurveyResponse {
  id: string;
  stakeholderId: string;
  stakeholderType: string;
  companyId: string;
  assessmentId: string;
  weight: number;
  ratings: Record<string, TopicRating>;
  submittedAt: Timestamp;
  isProxySubmission: boolean;
  proxyAgentUid: string | null;
}

export interface SurveyQuestion {
  id: string;   // e.g. "E1_Q1"
  text: string;
}

export interface GRITopic {
  id: string;
  code: string;             // e.g. "E1", "S3", "G2"
  name: string;             // e.g. "Climate Change & GHG Emissions"
  pillar: "environmental" | "social" | "governance";
  pillarCode: "E" | "S" | "G";
  description: string;
  griReference: string;     // e.g. "GRI 305"
  questions: SurveyQuestion[];
  subTopics?: GRISubTopic[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GRISubTopic {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export type QuadrantType = "critical" | "important" | "consider" | "monitor";

export interface TopicScore {
  impactScore: number;
  financialScore: number;
  combinedScore: number;
  quadrant: QuadrantType;
  respondentCount: number;
  comments: string[];
}

export interface ScoreDocument {
  topicScores: Record<string, TopicScore>;
  totalResponses: number;
  lastUpdated: Timestamp;
  impactThreshold: number;
  financialThreshold: number;
}

// ─── UI / Form Helpers ────────────────────────────────────────────────────────

export interface SelectOption {
  label: string;
  value: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}
