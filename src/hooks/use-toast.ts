
// This file is imported from shadcn, we'll reexport it
import { useToast as useToastOriginal, toast as toastOriginal } from "@/components/ui/use-toast";

// Re-export with the same names
export const useToast = useToastOriginal;
export const toast = toastOriginal;
