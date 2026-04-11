import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn, formatCurrency } from "../lib/utils"
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
  showBalance?: boolean
}

export function PartySearch({
  parties,
  value,
  onValueChange,
  placeholder = "Select party...",
  disabled = false,
  className,
  showBalance = true,
}: PartySearchProps) {
  const [open, setOpen] = React.useState(false)

  const getBalance = (party: Party) => {
    return (party.openingBalance || 0) + (party.currentDebit || 0) - (party.currentCredit || 0)
  }

  const selectedParty = parties.find((party) => party.id === value)
  const selectedBalance = selectedParty ? getBalance(selectedParty) : 0

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
          <div className="flex items-center justify-between w-full overflow-hidden">
            <span className="truncate mr-2">
              {selectedParty.name} ({selectedParty.type})
            </span>
            {showBalance && (
              <span className={cn(
                "text-xs font-bold shrink-0",
                selectedBalance >= 0 ? "text-blue-600" : "text-orange-600"
              )}>
                {formatCurrency(Math.abs(selectedBalance))}
                {selectedBalance >= 0 ? " Cr" : " Dr"}
              </span>
            )}
          </div>
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
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col">
                      <span>{party.name}</span>
                      <span className="text-xs text-muted-foreground uppercase">{party.type}</span>
                    </div>
                    {showBalance && (
                      <div className="text-right">
                        <p className={cn(
                          "text-xs font-bold",
                          getBalance(party) >= 0 ? "text-blue-600" : "text-orange-600"
                        )}>
                          {formatCurrency(Math.abs(getBalance(party)))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {getBalance(party) >= 0 ? "Cr" : "Dr"}
                        </p>
                      </div>
                    )}
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
