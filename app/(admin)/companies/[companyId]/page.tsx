import { redirect } from "next/navigation";
export default function CompanyDetailRedirect({ params }: { params: { companyId: string } }) {
  redirect(`/admin/companies/${params.companyId}`);
}
