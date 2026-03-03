import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface FormFieldProps {
  label: string; id: string; value: string; onChange: (value: string) => void
  placeholder?: string; type?: "text" | "textarea" | "number" | "password"; monospace?: boolean
}

export function FormField({ label, id, value, onChange, placeholder, type = "text", monospace }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {type === "textarea" ? (
        <Textarea id={id} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={monospace ? "font-mono text-sm" : ""} rows={4} />
      ) : (
        <Input id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={monospace ? "font-mono text-sm" : ""} />
      )}
    </div>
  )
}
