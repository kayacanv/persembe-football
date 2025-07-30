"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { User } from "@/app/lib/types"

interface PlayerNameAutocompleteProps {
  users: User[]
  value: string
  onChange: (value: string) => void
  onSelectUser: (user: User) => void
  disabled?: boolean
}

export function PlayerNameAutocomplete({
  users,
  value,
  onChange,
  onSelectUser,
  disabled = false,
}: PlayerNameAutocompleteProps) {
  const [open, setOpen] = React.useState(false)

  // Filter users based on the input value
  const filteredUsers = users.filter((user) => user.name.toLowerCase().includes(value.toLowerCase()))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || "İsim Soyisim"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="İsim ara..." value={value} onValueChange={onChange} className="h-9" />
          <CommandList>
            <CommandEmpty>Oyuncu bulunamadı</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              {filteredUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={user.name}
                  onSelect={() => {
                    onChange(user.name)
                    onSelectUser(user)
                    setOpen(false)
                  }}
                >
                  {user.name}
                  <Check className={cn("ml-auto h-4 w-4", value === user.name ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
              {value && filteredUsers.length === 0 && (
                <CommandItem
                  value={value}
                  onSelect={() => {
                    setOpen(false)
                  }}
                  className="text-muted-foreground italic"
                >
                  Yeni oyuncu: {value}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
