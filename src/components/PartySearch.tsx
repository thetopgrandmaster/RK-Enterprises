import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Party } from "../types"

interface PartySearchProps {
  parties: Party[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function PartySearch({
  parties,
  value,
  onValueChange,
  placeholder = "Select party...",
  disabled = false,
  className,
}: PartySearchProps) {
  const [open, setOpen] = React.useState(false)

  const selectedParty = parties.find((party) => party.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between font-normal",
          className
        )}
      >
        {selectedParty ? (
          <span className="truncate">
            {selectedParty.name} ({selectedParty.type})
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search party name..." />
          <CommandList>
            <CommandEmpty>No party found.</CommandEmpty>
            <CommandGroup>
              {parties.map((party) => (
                <CommandItem
                  key={party.id}
                  value={party.name}
                  onSelect={() => {
                    onValueChange(party.id === value ? "" : party.id!)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === party.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{party.name}</span>
                    <span className="text-xs text-muted-foreground uppercase">{party.type}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
