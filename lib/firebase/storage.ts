"use client";

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

/**
 * Upload a company logo to Firebase Storage.
 * Path: companies/{companyId}/logo
 * Returns the public download URL.
 */
export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `companies/${companyId}/logo`);
  const snapshot = await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: { uploadedBy: companyId },
  });
  return getDownloadURL(snapshot.ref);
}

/**
 * Delete a company logo from Firebase Storage.
 */
export async function deleteCompanyLogo(companyId: string): Promise<void> {
  const storageRef = ref(storage, `companies/${companyId}/logo`);
  await deleteObject(storageRef).catch(() => {
    // Ignore if file doesn't exist
  });
}
