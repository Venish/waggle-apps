"use client";

import { create } from "zustand";

export interface AdminAlertPayload {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "negative";
  onConfirm?: () => void;
}

interface AdminAlertState {
  isOpen: boolean;
  payload: AdminAlertPayload | null;
  openAlert: (payload: AdminAlertPayload) => void;
  closeAlert: () => void;
}

export const useAdminAlertStore = create<AdminAlertState>((set) => ({
  isOpen: false,
  payload: null,
  openAlert: (payload) => set({ isOpen: true, payload }),
  closeAlert: () => set({ isOpen: false, payload: null }),
}));
