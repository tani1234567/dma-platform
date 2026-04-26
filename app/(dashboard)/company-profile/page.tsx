"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import { PageShell } from "@/components/layout/PageShell";
import {
  useCompanyRegistrationStore,
  defaultEmployeeTable,
  type BasicInfoData,
  type ResourcesData,
} from "@/store/companyRegistrationStore";
import { upsertCompany, updateUserDocument, getCompany } from "@/lib/firebase/firestore";
import { uploadCompanyLogo } from "@/lib/firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import INDUSTRY_CATEGORIES from "@/data/industryTypes";
import type { EmployeeTable, EmployeeAgeGroup, AreaUnit, FuelUnit } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDERS = ["male", "female", "transgender"] as const;
const AGE_GROUPS = [
  { key: "age1830", label: "18 – 30" },
  { key: "age3140", label: "31 – 40" },
  { key: "age4150", label: "41 – 50" },
  { key: "age5160", label: "51 – 60" },
] as const;
const DEPARTMENTS = ["staff", "operations", "marketing"] as const;
type Gender = (typeof GENDERS)[number];
type AgeGroupKey = (typeof AGE_GROUPS)[number]["key"];
type Department = (typeof DEPARTMENTS)[number];

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Resources" },
  { n: 3, label: "Employees" },
] as const;

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              s.n < current
                ? "bg-[#333a8b] border-[#333a8b] text-white"
                : s.n === current
                ? "bg-[#333a8b] border-[#333a8b] text-white shadow-lg shadow-[#333a8b]/30"
                : "bg-white border-gray-300 text-gray-400"
            }`}>
              {s.n < current ? "✓" : s.n}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${s.n === current ? "text-[#333a8b]" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-20 h-0.5 mb-5 mx-1 transition-colors ${s.n < current ? "bg-[#333a8b]" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

const step1Schema = z.object({
  companyName:               z.string().min(2, "Company name is required"),
  cinNumber:                 z.string().regex(CIN_REGEX, "Invalid CIN — must be 21 characters starting with L or U"),
  industryType:              z.string().min(1, "Please select an industry type"),
  address:                   z.string().min(10, "Please enter the registered address"),
  manufacturingUnitLocation: z.string().min(2, "Location is required"),
  areaOfManufacturingUnit:   z.union([z.number().positive("Area must be greater than 0"), z.nan()]).optional().transform((v) => (typeof v === "number" && isNaN(v) ? undefined : v)),
  areaUnit:                  z.enum(["sqm", "acres", "sqft"]).optional(),
});

const step2Schema = z.object({
  totalWaterUsage_FY:             z.union([z.number().min(0, "Cannot be negative"), z.nan()]).optional().transform((v) => (typeof v === "number" && isNaN(v) ? undefined : v)),
  totalElectricityConsumption_FY: z.union([z.number().min(0, "Cannot be negative"), z.nan()]).optional().transform((v) => (typeof v === "number" && isNaN(v) ? undefined : v)),
  totalFuelConsumption_FY:        z.union([z.number().min(0, "Cannot be negative"), z.nan()]).optional().transform((v) => (typeof v === "number" && isNaN(v) ? undefined : v)),
  fuelUnit:                       z.enum(["litres", "GJ"]).optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ─── Industry Select ──────────────────────────────────────────────────────────

function IndustrySelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const selectedCategory = INDUSTRY_CATEGORIES.find((c) => c.types.includes(value));
  const [categoryLabel, setCategoryLabel] = useState(selectedCategory?.label ?? "");

  const categoryTypes = INDUSTRY_CATEGORIES.find((c) => c.label === categoryLabel)?.types ?? [];

  function handleCategoryChange(label: string) {
    setCategoryLabel(label);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <select
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]"
        value={categoryLabel}
        onChange={(e) => handleCategoryChange(e.target.value)}
        aria-invalid={!!error}
      >
        <option value="">Select a category…</option>
        {INDUSTRY_CATEGORIES.map((c) => (
          <option key={c.label} value={c.label}>{c.label}</option>
        ))}
      </select>

      {categoryLabel && (
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        >
          <option value="">Select an industry type…</option>
          {categoryTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1BasicInfo({ onNext }: { onNext: () => void }) {
  const { basicInfo, logoFile, logoPreviewUrl, setBasicInfo, setLogo, clearLogo } = useCompanyRegistrationStore();
  const [logoError, setLogoError]   = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(logoPreviewUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema) as any,
    defaultValues: {
      companyName: basicInfo?.companyName ?? "",
      cinNumber: basicInfo?.cinNumber ?? "",
      industryType: basicInfo?.industryType ?? "",
      address: basicInfo?.address ?? "",
      manufacturingUnitLocation: basicInfo?.manufacturingUnitLocation ?? "",
      areaOfManufacturingUnit: basicInfo?.areaOfManufacturingUnit,
      areaUnit: basicInfo?.areaUnit ?? "sqm",
    } as Step1Values,
  });

  const industryValue = watch("industryType");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) { setLogoError("Only JPG and PNG files are allowed"); return; }
    if (file.size > 2 * 1024 * 1024) { setLogoError("Logo must be under 2 MB"); return; }
    setLogoError(null);
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    setLogo(file, url);
  }

  return (
    <form onSubmit={handleSubmit(d => { setBasicInfo(d as BasicInfoData); onNext(); })} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="companyName">Company Name</Label>
        <Input id="companyName" placeholder="Acme Industries Pvt Ltd" {...register("companyName")} />
        {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cinNumber">CIN Number</Label>
        <Input id="cinNumber" placeholder="L17110MH1973PLC019786" className="font-mono uppercase" maxLength={21}
          {...register("cinNumber", { onChange: e => (e.target.value = e.target.value.toUpperCase()) })} />
        {errors.cinNumber && <p className="text-xs text-destructive">{errors.cinNumber.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>Industry Type</Label>
        <IndustrySelect value={industryValue} onChange={v => setValue("industryType", v, { shouldValidate: true })} error={errors.industryType?.message} />
      </div>
      <div className="space-y-1.5">
        <Label>Company Logo <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
        <div className="flex items-start gap-4">
          {localPreview ? (
            <div className="relative w-20 h-20 rounded-lg border overflow-hidden shrink-0">
              <Image src={localPreview} alt="Logo" fill className="object-contain p-1" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 bg-gray-50">
              <span className="text-2xl text-gray-300">🏢</span>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={handleLogoChange} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {localPreview ? "Change Logo" : "Upload Logo"}
            </Button>
            {localPreview && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setLocalPreview(null); clearLogo(); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="text-destructive hover:text-destructive">Remove</Button>
            )}
            <p className="text-xs text-muted-foreground">JPG or PNG, max 2 MB</p>
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Registered Address</Label>
        <textarea id="address" rows={3} placeholder="Plot No. 12, MIDC Industrial Area, Pune – 411019"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b] resize-none"
          {...register("address")} />
        {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manufacturingUnitLocation">Manufacturing Unit Location</Label>
        <Input id="manufacturingUnitLocation" placeholder="Pune, Maharashtra" {...register("manufacturingUnitLocation")} />
        {errors.manufacturingUnitLocation && <p className="text-xs text-destructive">{errors.manufacturingUnitLocation.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="areaOfManufacturingUnit">Area of Manufacturing Unit <span className="text-muted-foreground font-normal text-xs">(Optional)</span></Label>
          <Input id="areaOfManufacturingUnit" type="number" min={0} step="0.01" placeholder="5000"
            {...register("areaOfManufacturingUnit", { valueAsNumber: true })} />
          {errors.areaOfManufacturingUnit && <p className="text-xs text-destructive">{errors.areaOfManufacturingUnit.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="areaUnit">Unit</Label>
          <select id="areaUnit" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]" {...register("areaUnit")}>
            <option value="sqm">sq. metres (sqm)</option>
            <option value="acres">Acres</option>
            <option value="sqft">sq. feet (sqft)</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" variant="orange" className="px-8">Next →</Button>
      </div>
    </form>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

const FY_LABEL = (() => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${year}–${String(year + 1).slice(2)}`;
})();

function Step2Resources({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { resources, setResources } = useCompanyRegistrationStore();
  const { register, handleSubmit, formState: { errors } } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema) as any,
    defaultValues: {
      totalWaterUsage_FY: resources?.totalWaterUsage_FY,
      totalElectricityConsumption_FY: resources?.totalElectricityConsumption_FY,
      totalFuelConsumption_FY: resources?.totalFuelConsumption_FY,
      fuelUnit: resources?.fuelUnit ?? "litres",
    } as Step2Values,
  });

  return (
    <form onSubmit={handleSubmit(d => { setResources(d as ResourcesData); onNext(); })} className="space-y-5" noValidate>
      {[
        { id: "totalWaterUsage_FY" as const, label: "Total Water Usage", unit: "Kilolitres", placeholder: "12500" },
        { id: "totalElectricityConsumption_FY" as const, label: "Total Electricity Consumption", unit: "kWh", placeholder: "850000" },
      ].map(({ id, label, unit, placeholder }) => (
        <div key={id} className="space-y-1.5">
          <Label htmlFor={id}>{label} <span className="text-muted-foreground font-normal text-xs">(Last FY — {FY_LABEL}, Optional)</span></Label>
          <div className="flex gap-2">
            <Input id={id} type="number" min={0} step="0.01" placeholder={placeholder} className="flex-1"
              {...register(id, { valueAsNumber: true })} />
            <span className="inline-flex items-center px-3 rounded-md border bg-gray-50 text-sm text-muted-foreground">{unit}</span>
          </div>
          {errors[id] && <p className="text-xs text-destructive">{errors[id]?.message}</p>}
        </div>
      ))}
      <div className="space-y-1.5">
        <Label htmlFor="totalFuelConsumption_FY">Total Fuel Consumption <span className="text-muted-foreground font-normal text-xs">(Last FY — {FY_LABEL}, Optional)</span></Label>
        <div className="flex gap-2">
          <Input id="totalFuelConsumption_FY" type="number" min={0} step="0.01" placeholder="45000" className="flex-1"
            {...register("totalFuelConsumption_FY", { valueAsNumber: true })} />
          <select className="inline-flex items-center px-3 rounded-md border bg-white text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]" {...register("fuelUnit")}>
            <option value="litres">Litres</option>
            <option value="GJ">GJ (Gigajoules)</option>
          </select>
        </div>
        {errors.totalFuelConsumption_FY && <p className="text-xs text-destructive">{errors.totalFuelConsumption_FY.message}</p>}
      </div>
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>← Back</Button>
        <Button type="submit" variant="orange" className="px-8">Next →</Button>
      </div>
    </form>
  );
}

// ─── Employee Grid ────────────────────────────────────────────────────────────

function numVal(v: number | string): number {
  const n = typeof v === "string" ? parseInt(v, 10) : v;
  return isNaN(n) || n < 0 ? 0 : n;
}
function rowTotal(row: EmployeeTable[Gender]): number {
  return AGE_GROUPS.reduce((sum, { key }) => sum + DEPARTMENTS.reduce((s, d) => s + numVal(row[key as AgeGroupKey][d as keyof EmployeeAgeGroup]), 0), 0);
}
function colTotal(table: EmployeeTable, ageKey: AgeGroupKey, dept: Department): number {
  return GENDERS.reduce((sum, g) => sum + numVal(table[g][ageKey][dept as keyof EmployeeAgeGroup]), 0);
}
function grandTotal(table: EmployeeTable): number {
  return GENDERS.reduce((sum, g) => sum + rowTotal(table[g]), 0);
}

function EmployeeGrid({ title, data, onChange }: { title: string; data: EmployeeTable; onChange: (t: EmployeeTable) => void }) {
  const GENDER_LABELS: Record<Gender, string> = { male: "Male", female: "Female", transgender: "Transgender" };
  const DEPT_LABELS: Record<Department, string> = { staff: "Staff", operations: "Ops", marketing: "Mkt" };
  function updateCell(gender: Gender, ageKey: AgeGroupKey, dept: Department, raw: string) {
    onChange({ ...data, [gender]: { ...data[gender], [ageKey]: { ...data[gender][ageKey], [dept]: numVal(raw) } } });
  }
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[#333a8b] text-sm">{title}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#333a8b] text-white">
              <th className="px-3 py-2 text-left w-24 border-r border-white/20">Gender</th>
              {AGE_GROUPS.map(({ key, label }) => <th key={key} colSpan={3} className="px-3 py-2 text-center border-r border-white/20">Age {label}</th>)}
              <th className="px-3 py-2 text-center">Total</th>
            </tr>
            <tr className="bg-[#333a8b]/10 text-[#333a8b]">
              <th className="px-3 py-1.5 border-r border-gray-200" />
              {AGE_GROUPS.map(({ key }) => DEPARTMENTS.map(d => (
                <th key={`${key}-${d}`} className="px-2 py-1.5 text-center font-medium border-r border-gray-200 last:border-r-0">{DEPT_LABELS[d]}</th>
              )))}
              <th className="px-3 py-1.5 text-center font-medium" />
            </tr>
          </thead>
          <tbody>
            {GENDERS.map((gender, gi) => (
              <tr key={gender} className={gi % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1.5 font-medium border-r border-gray-200 capitalize">{GENDER_LABELS[gender]}</td>
                {AGE_GROUPS.map(({ key: ageKey }) => DEPARTMENTS.map(dept => (
                  <td key={`${ageKey}-${dept}`} className="px-1.5 py-1 border-r border-gray-200 last:border-r-0">
                    <input type="number" min={0} value={data[gender][ageKey][dept as keyof EmployeeAgeGroup]}
                      onChange={e => updateCell(gender, ageKey, dept, e.target.value)}
                      className="w-12 text-center rounded border border-gray-200 py-0.5 text-xs focus:outline-none focus:border-[#333a8b] focus:ring-1 focus:ring-[#333a8b]" />
                  </td>
                )))}
                <td className="px-3 py-1.5 text-center font-semibold text-[#333a8b]">{rowTotal(data[gender])}</td>
              </tr>
            ))}
            <tr className="bg-[#333a8b]/5 font-semibold">
              <td className="px-3 py-1.5 border-r border-gray-200 text-[#333a8b]">Total</td>
              {AGE_GROUPS.map(({ key: ageKey }) => DEPARTMENTS.map(dept => (
                <td key={`col-${ageKey}-${dept}`} className="px-1.5 py-1.5 text-center border-r border-gray-200 last:border-r-0 text-[#333a8b]">{colTotal(data, ageKey, dept)}</td>
              )))}
              <td className="px-3 py-1.5 text-center text-[#ff6900] font-bold">{grandTotal(data)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Step3Employees({ onBack, onSubmit: onWizardSubmit }: { onBack: () => void; onSubmit: (p: EmployeeTable, c: EmployeeTable) => Promise<void> }) {
  const { permanentEmployees, contractEmployees, setPermanentEmployees, setContractEmployees } = useCompanyRegistrationStore();
  const [permanent, setPermanent] = useState<EmployeeTable>(permanentEmployees);
  const [contract, setContract]   = useState<EmployeeTable>(contractEmployees);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    try { await onWizardSubmit(permanent, contract); }
    catch { setError("Submission failed. Please try again."); setSubmitting(false); }
  }

  return (
    <div className="space-y-8">
      <EmployeeGrid title="Permanent Employees (Optional)" data={permanent} onChange={t => { setPermanent(t); setPermanentEmployees(t); }} />
      <EmployeeGrid title="Contract Employees (Optional)"  data={contract}  onChange={t => { setContract(t);  setContractEmployees(t);  }} />
      <div className="flex items-center justify-end gap-3 rounded-lg border bg-[#333a8b]/5 px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">Total Employees (Permanent + Contract):</span>
        <span className="text-xl font-bold text-[#ff6900]">{grandTotal(permanent) + grandTotal(contract)}</span>
      </div>
      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2"><p className="text-sm text-red-700">{error}</p></div>}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>← Back</Button>
        <Button type="button" variant="orange" className="px-8" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Saving…" : "Save & Return to Dashboard"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STEP_TITLES: Record<1 | 2 | 3, { title: string; description: string }> = {
  1: { title: "Basic Information",    description: "Edit your company details" },
  2: { title: "Resource Consumption", description: "Last financial year data" },
  3: { title: "Employee Data",        description: "Headcount breakdown by age group" },
};

export default function CompanyProfilePage() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const store = useCompanyRegistrationStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    getCompany(firebaseUser.uid)
      .then(company => {
        if (company) {
          store.setBasicInfo({
            companyName:               company.name || "",
            cinNumber:                 company.cinNumber || "",
            industryType:              company.industry || "",
            address:                   company.address || "",
            manufacturingUnitLocation: company.manufacturingUnitLocation || "",
            areaOfManufacturingUnit:   company.areaOfManufacturingUnit ?? undefined,
            areaUnit:                  (company.areaUnit as AreaUnit) ?? undefined,
          });
          store.setResources({
            totalWaterUsage_FY:             company.totalWaterUsage_FY ?? undefined,
            totalElectricityConsumption_FY: company.totalElectricityConsumption_FY ?? undefined,
            totalFuelConsumption_FY:        company.totalFuelConsumption_FY ?? undefined,
            fuelUnit:                       (company.fuelUnit as FuelUnit) ?? undefined,
          });
          store.setPermanentEmployees(company.permanentEmployees || defaultEmployeeTable());
          store.setContractEmployees(company.contractEmployees   || defaultEmployeeTable());
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid]);

  const goNext = useCallback(() => store.setStep((store.step + 1) as 1 | 2 | 3), [store]);
  const goBack = useCallback(() => store.setStep((store.step - 1) as 1 | 2 | 3), [store]);

  async function handleFinalSubmit(permanentEmployees: EmployeeTable, contractEmployees: EmployeeTable) {
    if (!firebaseUser || !store.basicInfo || !store.resources) throw new Error("Missing data");
    const uid = firebaseUser.uid;
    let logoURL: string | undefined;
    if (store.logoFile) logoURL = await uploadCompanyLogo(uid, store.logoFile);

    const companyData: Parameters<typeof upsertCompany>[1] = {
      adminUid: uid, status: "active",
      name:                          store.basicInfo.companyName,
      cinNumber:                     store.basicInfo.cinNumber,
      industry:                      store.basicInfo.industryType,
      address:                       store.basicInfo.address,
      country:                       "India",
      manufacturingUnitLocation:     store.basicInfo.manufacturingUnitLocation,
    };
    if (logoURL !== undefined)                                        companyData.logoURL = logoURL;
    if (store.basicInfo.areaOfManufacturingUnit !== undefined)        companyData.areaOfManufacturingUnit = store.basicInfo.areaOfManufacturingUnit;
    if (store.basicInfo.areaUnit !== undefined)                       companyData.areaUnit = store.basicInfo.areaUnit;
    if (store.resources.totalWaterUsage_FY !== undefined)             companyData.totalWaterUsage_FY = store.resources.totalWaterUsage_FY;
    if (store.resources.totalElectricityConsumption_FY !== undefined) companyData.totalElectricityConsumption_FY = store.resources.totalElectricityConsumption_FY;
    if (store.resources.totalFuelConsumption_FY !== undefined)        companyData.totalFuelConsumption_FY = store.resources.totalFuelConsumption_FY;
    if (store.resources.fuelUnit !== undefined)                       companyData.fuelUnit = store.resources.fuelUnit;
    if (grandTotal(permanentEmployees) > 0)                           companyData.permanentEmployees = permanentEmployees;
    if (grandTotal(contractEmployees) > 0)                            companyData.contractEmployees = contractEmployees;

    await upsertCompany(uid, companyData);
    await updateUserDocument(uid, { registrationComplete: true, companyId: uid });
    store.reset();
    router.push("/dashboard");
  }

  const { title, description } = STEP_TITLES[store.step];

  if (loading) {
    return (
      <PageShell title="Company Profile" description="Loading your company data…">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading company data…</p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={title} description={description}>
      <button
        onClick={() => { store.reset(); router.push("/dashboard"); }}
        className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-5 transition-colors"
      >
        ← Back
      </button>

      <StepIndicator current={store.step} />

      <Card className="shadow-sm">
        <CardContent className="pt-6 pb-8 px-6 sm:px-8">
          {store.step === 1 && <Step1BasicInfo onNext={goNext} />}
          {store.step === 2 && <Step2Resources onNext={goNext} onBack={goBack} />}
          {store.step === 3 && <Step3Employees onBack={goBack} onSubmit={handleFinalSubmit} />}
        </CardContent>
      </Card>
    </PageShell>
  );
}
