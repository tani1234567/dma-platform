"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { useAuthStore } from "@/store/authStore";
import {
  useCompanyRegistrationStore,
  defaultEmployeeTable,
  type BasicInfoData,
  type ResourcesData,
} from "@/store/companyRegistrationStore";
import { upsertCompany, updateUserDocument } from "@/lib/firebase/firestore";
import { uploadCompanyLogo } from "@/lib/firebase/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import INDUSTRY_TYPES from "@/data/industryTypes";
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
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                s.n < current
                  ? "bg-[#333a8b] border-[#333a8b] text-white"
                  : s.n === current
                  ? "bg-[#333a8b] border-[#333a8b] text-white shadow-lg shadow-[#333a8b]/30"
                  : "bg-white border-gray-300 text-gray-400"
              }`}
            >
              {s.n < current ? "✓" : s.n}
            </div>
            <span
              className={`text-xs font-medium whitespace-nowrap ${
                s.n === current ? "text-[#333a8b]" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-20 h-0.5 mb-5 mx-1 transition-colors ${
                s.n < current ? "bg-[#333a8b]" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const CIN_REGEX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;

const step1Schema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  cinNumber: z
    .string()
    .regex(
      CIN_REGEX,
      "Invalid CIN — must be 21 characters starting with L or U (e.g. L17110MH1973PLC019786)"
    ),
  industryType: z.string().min(1, "Please select an industry type"),
  address: z.string().min(10, "Please enter the registered address"),
  manufacturingUnitLocation: z.string().min(2, "Location is required"),
  areaOfManufacturingUnit: z.number().positive("Area must be greater than 0"),
  areaUnit: z.enum(["sqm", "acres", "sqft"]),
});

const step2Schema = z.object({
  totalWaterUsage_FY: z.number().min(0, "Cannot be negative"),
  totalElectricityConsumption_FY: z.number().min(0, "Cannot be negative"),
  totalFuelConsumption_FY: z.number().min(0, "Cannot be negative"),
  fuelUnit: z.enum(["litres", "GJ"]),
});

// Derive form value types from schemas so the resolver and useForm agree
type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

// ─── Searchable Industry Select ───────────────────────────────────────────────

function IndustrySelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const filtered = query.length > 0
    ? INDUSTRY_TYPES.filter((t) => t.toLowerCase().includes(query.toLowerCase())).slice(0, 40)
    : INDUSTRY_TYPES.slice(0, 40);

  function select(item: string) {
    onChange(item);
    setQuery(item);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Input
        placeholder="Search industry type…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-invalid={!!error}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg text-sm">
          {filtered.map((item) => (
            <li
              key={item}
              className={`px-3 py-2 cursor-pointer hover:bg-[#333a8b]/10 ${
                item === value ? "bg-[#333a8b]/10 font-medium" : ""
              }`}
              onMouseDown={() => select(item)}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ─── Step 1 — Basic Info ──────────────────────────────────────────────────────

function Step1BasicInfo({ onNext }: { onNext: () => void }) {
  const { basicInfo, logoFile, logoPreviewUrl, setBasicInfo, setLogo, clearLogo } =
    useCompanyRegistrationStore();

  const [logoError, setLogoError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(logoPreviewUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: basicInfo ?? {
      companyName: "",
      cinNumber: "",
      industryType: "",
      address: "",
      manufacturingUnitLocation: "",
      areaOfManufacturingUnit: 0,
      areaUnit: "sqm",
    },
  });

  const industryValue = watch("industryType");

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setLogoError("Only JPG and PNG files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be under 2 MB");
      return;
    }

    setLogoError(null);
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setLogo(file, previewUrl);
  }

  function removeLogo() {
    setLocalPreview(null);
    clearLogo();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(data: Step1Values) {
    setBasicInfo(data as BasicInfoData);
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Company Name */}
      <div className="space-y-1.5">
        <Label htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          placeholder="Acme Industries Pvt Ltd"
          {...register("companyName")}
          aria-invalid={!!errors.companyName}
        />
        {errors.companyName && (
          <p className="text-xs text-destructive">{errors.companyName.message}</p>
        )}
      </div>

      {/* CIN Number */}
      <div className="space-y-1.5">
        <Label htmlFor="cinNumber">CIN Number</Label>
        <Input
          id="cinNumber"
          placeholder="L17110MH1973PLC019786"
          className="font-mono uppercase"
          maxLength={21}
          {...register("cinNumber", {
            onChange: (e) =>
              (e.target.value = e.target.value.toUpperCase()),
          })}
          aria-invalid={!!errors.cinNumber}
        />
        {errors.cinNumber ? (
          <p className="text-xs text-destructive">{errors.cinNumber.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            21-character Corporate Identification Number (L/U + 5 digits + state + year + type + 6 digits)
          </p>
        )}
      </div>

      {/* Industry Type */}
      <div className="space-y-1.5">
        <Label>Industry Type</Label>
        <IndustrySelect
          value={industryValue}
          onChange={(v) => setValue("industryType", v, { shouldValidate: true })}
          error={errors.industryType?.message}
        />
      </div>

      {/* Company Logo */}
      <div className="space-y-1.5">
        <Label>Company Logo</Label>
        <div className="flex items-start gap-4">
          {localPreview ? (
            <div className="relative w-20 h-20 rounded-lg border overflow-hidden flex-shrink-0">
              <Image src={localPreview} alt="Logo preview" fill className="object-contain p-1" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 bg-gray-50">
              <span className="text-2xl text-gray-300">🏢</span>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              className="hidden"
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              {localPreview ? "Change Logo" : "Upload Logo"}
            </Button>
            {localPreview && (
              <Button type="button" variant="ghost" size="sm" onClick={removeLogo}
                className="text-destructive hover:text-destructive">
                Remove
              </Button>
            )}
            <p className="text-xs text-muted-foreground">JPG or PNG, max 2 MB</p>
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>
        </div>
      </div>

      {/* Registered Address */}
      <div className="space-y-1.5">
        <Label htmlFor="address">Registered Address</Label>
        <textarea
          id="address"
          rows={3}
          placeholder="Plot No. 12, MIDC Industrial Area, Pune – 411019, Maharashtra"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b] disabled:opacity-50 resize-none"
          {...register("address")}
          aria-invalid={!!errors.address}
        />
        {errors.address && (
          <p className="text-xs text-destructive">{errors.address.message}</p>
        )}
      </div>

      {/* Manufacturing Unit Location */}
      <div className="space-y-1.5">
        <Label htmlFor="manufacturingUnitLocation">Manufacturing Unit Location</Label>
        <Input
          id="manufacturingUnitLocation"
          placeholder="Pune, Maharashtra"
          {...register("manufacturingUnitLocation")}
          aria-invalid={!!errors.manufacturingUnitLocation}
        />
        {errors.manufacturingUnitLocation && (
          <p className="text-xs text-destructive">{errors.manufacturingUnitLocation.message}</p>
        )}
      </div>

      {/* Area of Manufacturing Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="areaOfManufacturingUnit">Area of Manufacturing Unit</Label>
          <Input
            id="areaOfManufacturingUnit"
            type="number"
            min={0}
            step="0.01"
            placeholder="5000"
            {...register("areaOfManufacturingUnit", { valueAsNumber: true })}
            aria-invalid={!!errors.areaOfManufacturingUnit}
          />
          {errors.areaOfManufacturingUnit && (
            <p className="text-xs text-destructive">{errors.areaOfManufacturingUnit.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="areaUnit">Unit</Label>
          <select
            id="areaUnit"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]"
            {...register("areaUnit")}
          >
            <option value="sqm">sq. metres (sqm)</option>
            <option value="acres">Acres</option>
            <option value="sqft">sq. feet (sqft)</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="orange" className="px-8">
          Next →
        </Button>
      </div>
    </form>
  );
}

// ─── Step 2 — Resource Consumption ───────────────────────────────────────────

const FY_LABEL = (() => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${year}–${String(year + 1).slice(2)}`;
})();

type NumericResourceKey = keyof Omit<Step2Values, "fuelUnit">;

function ResourceField({
  id,
  label,
  unit,
  placeholder,
  reg,
  error,
}: {
  id: NumericResourceKey;
  label: string;
  unit: string;
  placeholder: string;
  reg: UseFormRegister<Step2Values>;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}{" "}
        <span className="text-muted-foreground font-normal text-xs">(Last Financial Year — {FY_LABEL})</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          placeholder={placeholder}
          className="flex-1"
          {...reg(id, { valueAsNumber: true })}
          aria-invalid={!!error}
        />
        <span className="inline-flex items-center px-3 rounded-md border bg-gray-50 text-sm text-muted-foreground whitespace-nowrap">
          {unit}
        </span>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Step2Resources({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { resources, setResources } = useCompanyRegistrationStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: resources ?? {
      totalWaterUsage_FY: 0,
      totalElectricityConsumption_FY: 0,
      totalFuelConsumption_FY: 0,
      fuelUnit: "litres",
    },
  });

  const fuelUnit = watch("fuelUnit");

  function onSubmit(data: Step2Values) {
    setResources(data as ResourcesData);
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <ResourceField
        id="totalWaterUsage_FY"
        label="Total Water Usage"
        unit="Kilolitres"
        placeholder="12500"
        reg={register}
        error={errors.totalWaterUsage_FY?.message}
      />

      <ResourceField
        id="totalElectricityConsumption_FY"
        label="Total Electricity Consumption"
        unit="kWh"
        placeholder="850000"
        reg={register}
        error={errors.totalElectricityConsumption_FY?.message}
      />

      <div className="space-y-1.5">
        <Label htmlFor="totalFuelConsumption_FY">
          Total Fuel Consumption{" "}
          <span className="text-muted-foreground font-normal text-xs">(Last Financial Year — {FY_LABEL})</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="totalFuelConsumption_FY"
            type="number"
            min={0}
            step="0.01"
            placeholder="45000"
            className="flex-1"
            {...register("totalFuelConsumption_FY", { valueAsNumber: true })}
            aria-invalid={!!errors.totalFuelConsumption_FY}
          />
          <select
            className="inline-flex items-center px-3 rounded-md border bg-white text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#333a8b]"
            {...register("fuelUnit")}
          >
            <option value="litres">Litres</option>
            <option value="GJ">GJ (Gigajoules)</option>
          </select>
        </div>
        {errors.totalFuelConsumption_FY && (
          <p className="text-xs text-destructive">{errors.totalFuelConsumption_FY.message}</p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" variant="orange" className="px-8">
          Next →
        </Button>
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
  return AGE_GROUPS.reduce(
    (sum, { key }) =>
      sum + DEPARTMENTS.reduce((s, d) => s + numVal(row[key as AgeGroupKey][d as keyof EmployeeAgeGroup]), 0),
    0
  );
}

function colTotal(table: EmployeeTable, ageKey: AgeGroupKey, dept: Department): number {
  return GENDERS.reduce((sum, g) => sum + numVal(table[g][ageKey][dept as keyof EmployeeAgeGroup]), 0);
}

function grandTotal(table: EmployeeTable): number {
  return GENDERS.reduce((sum, g) => sum + rowTotal(table[g]), 0);
}

function EmployeeGrid({
  title,
  data,
  onChange,
}: {
  title: string;
  data: EmployeeTable;
  onChange: (updated: EmployeeTable) => void;
}) {
  function updateCell(gender: Gender, ageKey: AgeGroupKey, dept: Department, raw: string) {
    const value = numVal(raw);
    onChange({
      ...data,
      [gender]: {
        ...data[gender],
        [ageKey]: {
          ...data[gender][ageKey],
          [dept]: value,
        },
      },
    });
  }

  const GENDER_LABELS: Record<Gender, string> = {
    male: "Male",
    female: "Female",
    transgender: "Transgender",
  };

  const DEPT_LABELS: Record<Department, string> = {
    staff: "Staff",
    operations: "Ops",
    marketing: "Mkt",
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[#333a8b] text-sm">{title}</h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            {/* Row 1: Age group headers */}
            <tr className="bg-[#333a8b] text-white">
              <th className="px-3 py-2 text-left w-24 border-r border-white/20">Gender</th>
              {AGE_GROUPS.map(({ key, label }) => (
                <th key={key} colSpan={3} className="px-3 py-2 text-center border-r border-white/20">
                  Age {label}
                </th>
              ))}
              <th className="px-3 py-2 text-center">Total</th>
            </tr>
            {/* Row 2: Department sub-headers */}
            <tr className="bg-[#333a8b]/10 text-[#333a8b]">
              <th className="px-3 py-1.5 border-r border-gray-200" />
              {AGE_GROUPS.map(({ key }) =>
                DEPARTMENTS.map((d) => (
                  <th key={`${key}-${d}`} className="px-2 py-1.5 text-center font-medium border-r border-gray-200 last:border-r-0">
                    {DEPT_LABELS[d]}
                  </th>
                ))
              )}
              <th className="px-3 py-1.5 text-center font-medium" />
            </tr>
          </thead>
          <tbody>
            {GENDERS.map((gender, gi) => (
              <tr key={gender} className={gi % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-1.5 font-medium border-r border-gray-200 capitalize">
                  {GENDER_LABELS[gender]}
                </td>
                {AGE_GROUPS.map(({ key: ageKey }) =>
                  DEPARTMENTS.map((dept) => (
                    <td key={`${ageKey}-${dept}`} className="px-1.5 py-1 border-r border-gray-200 last:border-r-0">
                      <input
                        type="number"
                        min={0}
                        value={data[gender][ageKey][dept as keyof EmployeeAgeGroup]}
                        onChange={(e) => updateCell(gender, ageKey, dept, e.target.value)}
                        className="w-12 text-center rounded border border-gray-200 py-0.5 text-xs focus:outline-none focus:border-[#333a8b] focus:ring-1 focus:ring-[#333a8b]"
                      />
                    </td>
                  ))
                )}
                <td className="px-3 py-1.5 text-center font-semibold text-[#333a8b]">
                  {rowTotal(data[gender])}
                </td>
              </tr>
            ))}
            {/* Column totals row */}
            <tr className="bg-[#333a8b]/5 font-semibold">
              <td className="px-3 py-1.5 border-r border-gray-200 text-[#333a8b]">Total</td>
              {AGE_GROUPS.map(({ key: ageKey }) =>
                DEPARTMENTS.map((dept) => (
                  <td key={`col-${ageKey}-${dept}`} className="px-1.5 py-1.5 text-center border-r border-gray-200 last:border-r-0 text-[#333a8b]">
                    {colTotal(data, ageKey, dept)}
                  </td>
                ))
              )}
              <td className="px-3 py-1.5 text-center text-[#ff6900] font-bold">
                {grandTotal(data)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Step 3 — Employee Data ───────────────────────────────────────────────────

function Step3Employees({
  onBack,
  onSubmit: onWizardSubmit,
}: {
  onBack: () => void;
  onSubmit: (permanent: EmployeeTable, contract: EmployeeTable) => Promise<void>;
}) {
  const {
    permanentEmployees,
    contractEmployees,
    setPermanentEmployees,
    setContractEmployees,
  } = useCompanyRegistrationStore();

  const [permanent, setPermanent] = useState<EmployeeTable>(permanentEmployees);
  const [contract, setContract] = useState<EmployeeTable>(contractEmployees);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePermanent(table: EmployeeTable) {
    setPermanent(table);
    setPermanentEmployees(table);
  }

  function updateContract(table: EmployeeTable) {
    setContract(table);
    setContractEmployees(table);
  }

  const combined = grandTotal(permanent) + grandTotal(contract);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onWizardSubmit(permanent, contract);
    } catch (err) {
      setError("Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <EmployeeGrid title="Permanent Employees" data={permanent} onChange={updatePermanent} />
      <EmployeeGrid title="Contract Employees" data={contract} onChange={updateContract} />

      {/* Grand combined total */}
      <div className="flex items-center justify-end gap-3 rounded-lg border bg-[#333a8b]/5 px-4 py-3">
        <span className="text-sm font-medium text-muted-foreground">
          Total Employees (Permanent + Contract):
        </span>
        <span className="text-xl font-bold text-[#ff6900]">{combined}</span>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
          ← Back
        </Button>
        <Button
          type="button"
          variant="orange"
          className="px-8"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Submit & Go to Dashboard"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanySetupPage() {
  const router = useRouter();
  const { firebaseUser } = useAuthStore();
  const store = useCompanyRegistrationStore();

  const goNext = useCallback(() => {
    store.setStep((store.step + 1) as 1 | 2 | 3);
  }, [store]);

  const goBack = useCallback(() => {
    store.setStep((store.step - 1) as 1 | 2 | 3);
  }, [store]);

  async function handleFinalSubmit(
    permanentEmployees: EmployeeTable,
    contractEmployees: EmployeeTable
  ) {
    if (!firebaseUser || !store.basicInfo || !store.resources) {
      throw new Error("Missing required data");
    }

    const uid = firebaseUser.uid;

    // Upload logo if selected
    let logoURL: string | undefined;
    if (store.logoFile) {
      logoURL = await uploadCompanyLogo(uid, store.logoFile);
    }

    // Write company document
    await upsertCompany(uid, {
      adminUid: uid,
      status: "active",
      name: store.basicInfo.companyName,
      cinNumber: store.basicInfo.cinNumber,
      industry: store.basicInfo.industryType,
      address: store.basicInfo.address,
      country: "India",
      manufacturingUnitLocation: store.basicInfo.manufacturingUnitLocation,
      areaOfManufacturingUnit: store.basicInfo.areaOfManufacturingUnit,
      areaUnit: store.basicInfo.areaUnit,
      logoURL,
      totalWaterUsage_FY: store.resources.totalWaterUsage_FY,
      totalElectricityConsumption_FY: store.resources.totalElectricityConsumption_FY,
      totalFuelConsumption_FY: store.resources.totalFuelConsumption_FY,
      fuelUnit: store.resources.fuelUnit,
      permanentEmployees,
      contractEmployees,
    });

    // Mark user's registration as complete and link companyId
    await updateUserDocument(uid, {
      registrationComplete: true,
      companyId: uid,
    });

    store.reset();
    router.push("/dashboard");
  }

  const STEP_TITLES: Record<1 | 2 | 3, { title: string; description: string }> = {
    1: { title: "Basic Information", description: "Tell us about your company" },
    2: { title: "Resource Consumption", description: "Last financial year data" },
    3: { title: "Employee Data", description: "Headcount breakdown by age group" },
  };

  const { title, description } = STEP_TITLES[store.step];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="mb-8 text-center">
        <p className="text-sm text-[#ff6900] font-semibold uppercase tracking-wide mb-1">
          Company Setup
        </p>
        <h1 className="text-2xl font-bold text-[#333a8b]">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <StepIndicator current={store.step} />

      <Card className="shadow-sm">
        <CardContent className="pt-6 pb-8 px-6 sm:px-8">
          {store.step === 1 && <Step1BasicInfo onNext={goNext} />}
          {store.step === 2 && <Step2Resources onNext={goNext} onBack={goBack} />}
          {store.step === 3 && (
            <Step3Employees onBack={goBack} onSubmit={handleFinalSubmit} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
