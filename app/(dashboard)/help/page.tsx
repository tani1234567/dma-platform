"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Mail, Phone, AlertCircle, CheckCircle2, Users, BarChart3, Briefcase, ListTodo } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { UserRole } from "@/types";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  roles: UserRole[];
}

const FAQ_DATA: FAQItem[] = [
  // Company Admin FAQs
  {
    id: "ca-1",
    category: "Assessments",
    question: "How do I launch a survey to stakeholders?",
    answer: "Go to your assessment dashboard, select the assessment you want to launch, click 'Launch Survey', confirm the selected topics and stakeholders, and click 'Send Invites'. Stakeholders will receive survey links via email and have access until the token expiry date.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  {
    id: "ca-2",
    category: "Assessments",
    question: "What is a materiality assessment?",
    answer: "A materiality assessment is a structured survey where stakeholders rate ESG (Environmental, Social, Governance) topics based on their impact to the business and financial significance. This helps identify which issues matter most to your stakeholders and should be prioritized in your ESG strategy.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  {
    id: "ca-3",
    category: "Results & Analysis",
    question: "How do I interpret the materiality matrix?",
    answer: "The materiality matrix plots topics on two axes: Impact (vertical) and Financial Significance (horizontal). Topics in the upper-right quadrant are 'Critical' and require immediate attention. Adjust the threshold lines using the controls on the matrix to customize what you consider material.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  {
    id: "ca-4",
    category: "Field Agents",
    question: "How do I add a field agent to my company?",
    answer: "Go to 'Field Agents' in your sidebar, click 'Add Agent', enter their name, email, and password. They'll receive a welcome email. Once added, they can submit surveys on behalf of your stakeholders.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  {
    id: "ca-5",
    category: "Field Agents",
    question: "What if I need to suspend an agent?",
    answer: "Go to 'Field Agents', find the agent in the list, and click 'Suspend'. This revokes their access to the platform. You can 'Restore' them anytime to re-enable access.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  {
    id: "ca-6",
    category: "Stakeholders",
    question: "Can I add stakeholders after launching a survey?",
    answer: "Yes. Go to your assessment, click 'Manage Stakeholders', and add new ones. New stakeholders will appear as 'Uninvited' and you can send them survey links separately.",
    roles: [UserRole.COMPANY_ADMIN],
  },
  // Field Agent FAQs
  {
    id: "fa-1",
    category: "Dashboard",
    question: "What is the field agent role?",
    answer: "As a field agent, you represent a company and submit surveys on behalf of stakeholders who may not have direct access. You fill out the same survey questions but on behalf of the stakeholder, tracking their specific insights and perspectives.",
    roles: [UserRole.FIELD_AGENT],
  },
  {
    id: "fa-2",
    category: "Assignments",
    question: "How do I see my survey assignments?",
    answer: "Click 'Assignments' in your sidebar. You'll see a list of all stakeholders you need to submit surveys for, along with their status (Pending or Completed). Use the search and filter tabs to find specific stakeholders.",
    roles: [UserRole.FIELD_AGENT],
  },
  {
    id: "fa-3",
    category: "Survey Submission",
    question: "How do I submit a survey for a stakeholder?",
    answer: "From the Assignments page, click 'Submit Survey' next to the stakeholder. Answer rating questions (1-5 scale) for each topic, optionally add comments, and click 'Submit'. The survey is then sent to scoring and results recalculation.",
    roles: [UserRole.FIELD_AGENT],
  },
  {
    id: "fa-4",
    category: "Survey Submission",
    question: "What does the impact/financial rating mean?",
    answer: "Impact (1-5): How significantly this topic affects the company's operations and strategy. Financial (1-5): How much this topic affects financial performance or risk. Both scales help the company understand stakeholder perspectives on each ESG topic.",
    roles: [UserRole.FIELD_AGENT],
  },
  {
    id: "fa-5",
    category: "Assignments",
    question: "Can I submit a survey multiple times?",
    answer: "No. Once a survey is submitted for a stakeholder, it's marked as 'Completed' and cannot be edited. If changes are needed, contact your company administrator.",
    roles: [UserRole.FIELD_AGENT],
  },
  // Super Admin FAQs
  {
    id: "admin-1",
    category: "Company Management",
    question: "How do I create a new company?",
    answer: "Go to 'Companies' in the admin panel, click 'New Company', enter basic information (company name, CIN, industry), and the company will be created. The admin will then need to complete their profile with resource and employee data.",
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    id: "admin-2",
    category: "Field Agents",
    question: "How do I create field agents?",
    answer: "Go to 'Field Agents' in the admin panel, click 'New Agent', enter their name, email, password, and select the company they'll work for. They'll receive a welcome email with login credentials.",
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    id: "admin-3",
    category: "GRI Topics",
    question: "How do I manage GRI topics and questions?",
    answer: "Go to 'GRI Topics', select a topic, click 'Edit Questions', and add, edit, or remove survey questions. Changes apply to all future assessments using that topic.",
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    id: "admin-4",
    category: "Platform Management",
    question: "How do I revoke access for an agent or company?",
    answer: "Go to 'Field Agents' or 'Companies', find the entry, and toggle the 'Active' status. This disables their authentication without deleting their data.",
    roles: [UserRole.SUPER_ADMIN],
  },
];

const CATEGORIES: Record<string, { icon: React.ReactNode; color: string }> = {
  Assessments:          { icon: <BarChart3 size={16} />, color: "bg-blue-50 text-blue-700 border-blue-200" },
  "Results & Analysis": { icon: <BarChart3 size={16} />, color: "bg-purple-50 text-purple-700 border-purple-200" },
  "Field Agents":       { icon: <Users size={16} />,     color: "bg-green-50 text-green-700 border-green-200" },
  Stakeholders:         { icon: <Users size={16} />,     color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  Dashboard:            { icon: <BarChart3 size={16} />, color: "bg-orange-50 text-orange-700 border-orange-200" },
  Assignments:          { icon: <ListTodo size={16} />,  color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  "Survey Submission":  { icon: <CheckCircle2 size={16} />, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Company Management": { icon: <Briefcase size={16} />, color: "bg-rose-50 text-rose-700 border-rose-200" },
  "GRI Topics":         { icon: <ListTodo size={16} />,  color: "bg-amber-50 text-amber-700 border-amber-200" },
  "Platform Management":{ icon: <Briefcase size={16} />, color: "bg-slate-50 text-slate-700 border-slate-200" },
};

function FAQAccordion({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  const catData = CATEGORIES[item.category];
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-start justify-between gap-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${catData.color}`}>
              {catData.icon}
              {item.category}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900">{item.question}</h3>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-700 leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const relevantFAQs = FAQ_DATA.filter((faq) => !role || faq.roles.includes(role));

  const filtered = search.trim()
    ? relevantFAQs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(search.toLowerCase()) ||
          faq.answer.toLowerCase().includes(search.toLowerCase())
      )
    : relevantFAQs;

  const byCategory = filtered.reduce((acc, faq) => {
    if (!acc[faq.category]) acc[faq.category] = [];
    acc[faq.category].push(faq);
    return acc;
  }, {} as Record<string, FAQItem[]>);

  function toggleItem(id: string) {
    const next = new Set(openItems);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenItems(next);
  }

  return (
    <PageShell title="Help & Support" description="Find answers to common questions and learn how to use the platform effectively">
      <button
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-gray-700 flex items-center gap-1 mb-5 transition-colors"
      >
        ← Back
      </button>

      {/* Search */}
      <div className="mb-8 relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search help articles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10 text-sm"
        />
      </div>

      {/* FAQ Items */}
      <div className="space-y-8">
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {CATEGORIES[category]?.icon}
              {category}
            </h2>
            <div className="space-y-2">
              {items.map((faq) => (
                <FAQAccordion
                  key={faq.id}
                  item={faq}
                  isOpen={openItems.has(faq.id)}
                  onToggle={() => toggleItem(faq.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={32} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">No results found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="mt-12 p-6 bg-gradient-to-br from-[#eff2ff] to-white rounded-xl border border-[#333a8b]/10">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Can't find what you're looking for?</h2>
        <p className="text-sm text-gray-600 mb-4">
          Our support team is here to help. Get in touch and we'll respond within 24 hours.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="mailto:support@swifora.com"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#333a8b] hover:bg-[#2a3070] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Mail size={16} />
            Email Support
          </a>
          <a
            href="tel:+919876543210"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-900 text-sm font-medium rounded-lg transition-colors"
          >
            <Phone size={16} />
            Call Us
          </a>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 pb-8">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">💡 Pro Tip</h3>
          <p className="text-xs text-blue-700">Use the search bar above to quickly find answers to specific questions.</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="text-sm font-semibold text-green-900 mb-1">✓ Best Practice</h3>
          <p className="text-xs text-green-700">Invite diverse stakeholders for the most comprehensive materiality assessment.</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h3 className="text-sm font-semibold text-purple-900 mb-1">📊 Feature</h3>
          <p className="text-xs text-purple-700">Download reports as PDF or Excel to share results with your team.</p>
        </div>
      </div>
    </PageShell>
  );
}
