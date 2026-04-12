import { create } from "zustand";
import { User as FirebaseUser } from "firebase/auth";
import { User, UserRole } from "@/types";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userDoc: User | null;
  role: UserRole | null;
  loading: boolean;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setUserDoc: (doc: User | null) => void;
  setRole: (role: UserRole | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userDoc: null,
  role: null,
  loading: true,
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserDoc: (doc) => set({ userDoc: doc }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ firebaseUser: null, userDoc: null, role: null, loading: false }),
}));
