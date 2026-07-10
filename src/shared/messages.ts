import type { StatusItem } from "./types";

export const success = (message: string): StatusItem => ({ severity: "success", message });
export const error = (message: string): StatusItem => ({ severity: "error", message });
export const warning = (message: string): StatusItem => ({ severity: "warning", message });
export const info = (message: string): StatusItem => ({ severity: "info", message });
