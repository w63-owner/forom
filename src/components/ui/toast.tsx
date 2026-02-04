 "use client"

 import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useRef,
   useState,
   type ReactNode,
 } from "react"
 import { CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react"
 import { cn } from "@/lib/utils"

 type ToastVariant = "success" | "error" | "info" | "warning"

 type Toast = {
   id: number
   title?: string
   description?: string
   variant: ToastVariant
 }

 type ToastOptions = {
   title?: string
   description?: string
   variant?: ToastVariant
   /** Durée d’affichage en ms (défaut: 4000) */
   durationMs?: number
 }

 type ToastContextValue = {
   showToast: (options: ToastOptions) => void
 }

 const ToastContext = createContext<ToastContextValue | null>(null)

 export function useToast() {
   const ctx = useContext(ToastContext)
   if (!ctx) {
     throw new Error("useToast must be used within a ToastProvider")
   }
   return ctx
 }

 type ProviderProps = {
   children: ReactNode
 }

 export function ToastProvider({ children }: ProviderProps) {
   const [toasts, setToasts] = useState<Toast[]>([])
   const idRef = useRef(0)

   const removeToast = useCallback((id: number) => {
     setToasts((current) => current.filter((t) => t.id !== id))
   }, [])

   const showToast = useCallback(
     ({ title, description, variant = "info", durationMs = 4000 }: ToastOptions) => {
       const id = ++idRef.current
       const toast: Toast = { id, title, description, variant }
       setToasts((current) => [...current, toast])
       // Auto-dismiss
       window.setTimeout(() => removeToast(id), durationMs)
     },
     [removeToast]
   )

   const value: ToastContextValue = { showToast }

   return (
     <ToastContext.Provider value={value}>
       {children}
       <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:justify-end">
         <div className="flex w-full max-w-sm flex-col gap-2 sm:max-w-md">
           {toasts.map((toast) => (
             <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
           ))}
         </div>
       </div>
     </ToastContext.Provider>
   )
 }

 type ToastItemProps = {
   toast: Toast
   onClose: (id: number) => void
 }

 function ToastItem({ toast, onClose }: ToastItemProps) {
   const { id, title, description, variant } = toast

   const Icon = {
     success: CheckCircle2,
     error: XCircle,
     info: Info,
     warning: AlertTriangle,
   }[variant]

   useEffect(() => {
     // Nettoyage au démontage en cas de fermeture manuelle
     return () => {
       onClose(id)
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [])

   return (
     <div
       className={cn(
         "pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-md backdrop-blur-sm",
         "bg-card/95 border-border",
         variant === "success" && "border-emerald-500/40 text-emerald-900 dark:text-emerald-100",
         variant === "error" && "border-destructive/60 text-destructive dark:text-destructive",
         variant === "info" && "border-sky-500/40 text-sky-900 dark:text-sky-100",
         variant === "warning" && "border-amber-500/50 text-amber-900 dark:text-amber-100"
       )}
     >
       <Icon className="mt-0.5 size-4 shrink-0" />
       <div className="flex-1 space-y-0.5">
         {title && <p className="font-medium">{title}</p>}
         {description && (
           <p className="text-xs text-muted-foreground">{description}</p>
         )}
       </div>
       <button
         type="button"
         onClick={() => onClose(id)}
         className="mt-0.5 text-xs text-muted-foreground hover:text-foreground"
       >
         ×
       </button>
     </div>
   )
 }

