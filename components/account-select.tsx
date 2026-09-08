"use client";

import { Icon } from "@/components/ui-icons";

export interface AccountOption {
  id: string;
  username: string;
  instagramId: string;
  name?: string | null;
}

interface AccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  label?: string;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  includeAll = true,
  label = "Konto Instagram",
}: AccountSelectProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="app-label">
        {label}
      </span>
      <span className="relative block min-w-0">
        <Icon name="instagram" size={17} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="app-field min-w-0 appearance-none pl-10 pr-10 sm:min-w-52"
        >
          {includeAll && <option value="all">Wszystkie konta</option>}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              @{account.username}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

