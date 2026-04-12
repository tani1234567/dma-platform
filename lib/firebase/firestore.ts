import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  increment,
  onSnapshot,
  writeBatch,
  DocumentReference,
  QueryConstraint,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./config";
import { User, Company, Assessment, AssessmentStatus, Stakeholder, SurveyTokenStatus, GRITopic, ScoreDocument, UserRole } from "@/types";

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUserDocument(
  uid: string,
  data: Partial<Omit<User, "uid" | "createdAt" | "updatedAt">>
) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserDocument(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function updateUserDocument(uid: string, data: Partial<User>) {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ─── Companies ────────────────────────────────────────────────────────────────

/**
 * Create or overwrite a company document using the auth UID as the document ID.
 * Called at the end of the company registration wizard.
 */
export async function upsertCompany(
  uid: string,
  data: Omit<Company, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  await setDoc(doc(db, "companies", uid), {
    ...data,
    id: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createCompany(data: Omit<Company, "id" | "createdAt" | "updatedAt">) {
  const ref = await addDoc(collection(db, "companies"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCompany(id: string): Promise<Company | null> {
  const snap = await getDoc(doc(db, "companies", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Company) : null;
}

export async function updateCompany(id: string, data: Partial<Company>) {
  await updateDoc(doc(db, "companies", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getCompaniesByAdmin(adminUid: string): Promise<Company[]> {
  const q = query(collection(db, "companies"), where("adminUid", "==", adminUid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Company);
}

// ─── Assessments ──────────────────────────────────────────────────────────────

export async function createAssessment(
  companyId: string,
  data: Omit<Assessment, "id" | "companyId" | "createdAt" | "updatedAt">
) {
  const ref = await addDoc(
    collection(db, "companies", companyId, "assessments"),
    {
      ...data,
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function getAssessment(companyId: string, assessmentId: string): Promise<Assessment | null> {
  const snap = await getDoc(doc(db, "companies", companyId, "assessments", assessmentId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() }) as Assessment : null;
}

export async function getAssessments(companyId: string): Promise<Assessment[]> {
  const q = query(
    collection(db, "companies", companyId, "assessments"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Assessment);
}

export async function updateAssessment(companyId: string, assessmentId: string, data: Partial<Assessment>) {
  await updateDoc(doc(db, "companies", companyId, "assessments", assessmentId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Create a new assessment doc keyed by the financial year string (e.g. "2024-25").
 * Using setDoc so the document ID matches the FY for easy look-up.
 */
export async function createAssessmentForYear(
  companyId: string,
  fyYear: string,
  createdBy: string
): Promise<void> {
  await setDoc(doc(db, "companies", companyId, "assessments", fyYear), {
    companyId,
    financialYear: fyYear,
    status: AssessmentStatus.DRAFT,
    selectedTopics: [],
    stakeholderWeightages: {
      Management: 0.25,
      Employees: 0.15,
      Customers: 0.15,
      Suppliers: 0.10,
      Community: 0.10,
      Investors: 0.15,
      "Experts/NGOs": 0.10,
    },
    stakeholderCount: 0,
    responseCount: 0,
    surveyLinkExpiryDays: 45,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  });
}

// ─── Stakeholders ─────────────────────────────────────────────────────────────

export async function getStakeholders(companyId: string, assessmentId: string): Promise<Stakeholder[]> {
  const q = query(
    collection(db, "companies", companyId, "assessments", assessmentId, "stakeholders"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Stakeholder);
}

/** Real-time listener — returns unsubscribe fn. */
export function onStakeholders(
  companyId: string,
  assessmentId: string,
  callback: (stakeholders: Stakeholder[]) => void
): () => void {
  const q = query(
    collection(db, "companies", companyId, "assessments", assessmentId, "stakeholders"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Stakeholder));
  });
}

/** Write a single stakeholder doc keyed by the survey token UUID. */
export async function addStakeholderDoc(
  companyId: string,
  assessmentId: string,
  token: string,
  data: Omit<Stakeholder, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  await setDoc(
    doc(db, "companies", companyId, "assessments", assessmentId, "stakeholders", token),
    { ...data, id: token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
  );
}

export async function updateStakeholderDoc(
  companyId: string,
  assessmentId: string,
  stakeholderId: string,
  data: Partial<Omit<Stakeholder, "id" | "companyId" | "assessmentId">>
): Promise<void> {
  await updateDoc(
    doc(db, "companies", companyId, "assessments", assessmentId, "stakeholders", stakeholderId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

export async function deleteStakeholderDoc(
  companyId: string,
  assessmentId: string,
  stakeholderId: string
): Promise<void> {
  await deleteDoc(
    doc(db, "companies", companyId, "assessments", assessmentId, "stakeholders", stakeholderId)
  );
}

/** Batch-write multiple stakeholder docs (max 500). */
export async function batchAddStakeholderDocs(
  companyId: string,
  assessmentId: string,
  items: Array<{ token: string; data: Omit<Stakeholder, "id" | "createdAt" | "updatedAt"> }>
): Promise<void> {
  const batch = writeBatch(db);
  for (const { token, data } of items) {
    const ref = doc(db, "companies", companyId, "assessments", assessmentId, "stakeholders", token);
    batch.set(ref, { ...data, id: token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  await batch.commit();
}

/** Increment or decrement the stakeholderCount on the assessment doc. */
export async function changeAssessmentStakeholderCount(
  companyId: string,
  assessmentId: string,
  delta: number
): Promise<void> {
  await updateDoc(doc(db, "companies", companyId, "assessments", assessmentId), {
    stakeholderCount: increment(delta),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Batch-update all stakeholder docs with survey links + mark assessment as launched.
 * Returns computed links for console logging / email sending in the caller.
 */
export async function launchAssessmentBatch(
  companyId: string,
  assessmentId: string,
  stakeholders: Stakeholder[],
  appUrl: string
): Promise<Array<{ name: string; email: string; link: string }>> {
  const batch = writeBatch(db);
  const links: Array<{ name: string; email: string; link: string }> = [];

  for (const s of stakeholders) {
    const link = `${appUrl}/survey?token=${s.surveyToken}`;
    links.push({ name: s.name, email: s.email, link });
    batch.update(
      doc(db, "companies", companyId, "assessments", assessmentId, "stakeholders", s.id),
      {
        surveyLink: link,
        status: SurveyTokenStatus.SENT,
        emailSentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  }

  batch.update(doc(db, "companies", companyId, "assessments", assessmentId), {
    status: AssessmentStatus.STAKEHOLDER_SURVEY,
    launchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return links;
}

// ─── GRI Topics ───────────────────────────────────────────────────────────────

export async function getGRITopics(): Promise<GRITopic[]> {
  const q = query(collection(db, "gri_topics"), where("isActive", "==", true), orderBy("code"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GRITopic);
}

// ─── Scores ───────────────────────────────────────────────────────────────────

export async function getScores(
  companyId: string,
  assessmentId: string
): Promise<ScoreDocument | null> {
  const snap = await getDoc(
    doc(db, "companies", companyId, "assessments", assessmentId, "scores", "main")
  );
  if (!snap.exists()) return null;
  return snap.data() as ScoreDocument;
}
