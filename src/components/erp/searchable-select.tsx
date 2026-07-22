'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  keywords?: string[]
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string | null
  onChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  renderValue?: (option: SearchableSelectOption | undefined) => React.ReactNode
}

/**
 * Combobox built on shadcn Command + Popover. Searches across label,
 * description and keywords. Shows a check mark on the active item.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  emptyMessage = 'No results found.',
  className,
  disabled,
  variant = 'outline',
  size = 'default',
  renderValue,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selected = React.useMemo(
    () => options.find(o => o.value === value),
    [options, value],
  )

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(o => {
      const haystack = [o.label, o.description, ...(o.keywords || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [options, search])

  function handleSelect(v: string) {
    onChange?.(v)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate text-left">
            {selected
              ? (renderValue ? renderValue(selected) : selected.label)
              : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)', minWidth: '14rem' }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filtered.map(o => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => handleSelect(o.value)}
                >
                  <div className="flex flex-1 min-w-0 flex-col items-start">
                    <span className="truncate">{o.label}</span>
                    {o.description && (
                      <span className="text-xs text-muted-foreground truncate w-full">
                        {o.description}
                      </span>
                    )}
                  </div>
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === o.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
