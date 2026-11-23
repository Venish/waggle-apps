"use client";

import { create } from "zustand";

export interface WebAlertPayload {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  onConfirm?: () => void;
}

interface WebAlertState {
  isOpen: boolean;
  payload: WebAlertPayload | null;
  openAlert: (payload: WebAlertPayload) => void;
  closeAlert: () => void;
}

export const useWebAlertStore = create<WebAlertState>((set) => ({
  isOpen: false,
  payload: null,
  openAlert: (payload) => set({ isOpen: true, payload }),
  closeAlert: () => set({ isOpen: false, payload: null }),
}));
