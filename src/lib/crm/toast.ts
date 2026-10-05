import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  tone: "default" | "success" | "error";
  action?: { label: string; href?: string; onClick?: () => void };
}

let n = 0;
export const useToasts = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

export function toast(message: string, tone: Toast["tone"] = "default", action?: Toast["action"]) {
  const t = { id: ++n, message, tone, action };
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), t] }));
  setTimeout(() => useToasts.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 4200);
}
