"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COUNTRIES } from "@/app/lib/phone"

type CountryPhoneInputProps = {
  dial: string
  national: string
  onDialChange: (dial: string) => void
  onNationalChange: (national: string) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

// Country-code picker + national-number field. Combine the two values into E.164
// with `toE164(dial, national)` from app/lib/phone before saving. Mobile-first:
// a compact flag/+code trigger next to a full-width tel input.
export function CountryPhoneInput({
  dial,
  national,
  onDialChange,
  onNationalChange,
  id,
  placeholder,
  disabled,
  autoFocus,
}: CountryPhoneInputProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={dial} onValueChange={onDialChange} disabled={disabled}>
        <SelectTrigger className="w-[7.5rem] shrink-0" aria-label="Country code">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">
                {COUNTRIES.find((c) => c.dial === dial)?.flag ?? "🌐"}
              </span>
              <span>+{dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.dial}>
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{c.flag}</span>
                <span>{c.name}</span>
                <span className="text-muted-foreground">+{c.dial}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        value={national}
        onChange={(e) => onNationalChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  )
}

export default CountryPhoneInput
