"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface MemberSearchOption {
  id: string;
  email: string;
  displayName: string;
}

interface MemberSearchSelectProps {
  value: Pick<MemberSearchOption, "email" | "displayName"> | null;
  onChange: (member: MemberSearchOption | null) => void;
  excludeMemberId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function MemberSearchSelect({
  value,
  onChange,
  excludeMemberId,
  placeholder = "Search by name or email",
  disabled = false,
}: MemberSearchSelectProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      setQuery("");
      setResults([]);
      setOpen(false);
      return;
    }
    setQuery(value.displayName || value.email);
  }, [value]);

  const fetchResults = useCallback(
    async (search: string) => {
      if (!user || search.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({ search: search.trim() });
        if (excludeMemberId) params.set("exclude", excludeMemberId);

        const res = await fetch(`/api/console/members/lookup?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await res.json()) as {
          members?: MemberSearchOption[];
          error?: string;
        };
        if (!res.ok) {
          setResults([]);
          return;
        }
        setResults(data.members ?? []);
      } finally {
        setLoading(false);
      }
    },
    [user, excludeMemberId]
  );

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void fetchResults(query);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, open, fetchResults]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (member: MemberSearchOption) => {
    onChange(member);
    setQuery(member.displayName || member.email);
    setOpen(false);
  };

  const handleInputChange = (next: string) => {
    setQuery(next);
    if (value && next !== (value.displayName || value.email)) {
      onChange(null);
    }
    setOpen(true);
  };

  const showHint = open && query.trim().length < 2;
  const showEmpty =
    open && query.trim().length >= 2 && !loading && results.length === 0;
  const showResults = open && query.trim().length >= 2 && results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          className="border-white/10 bg-black py-2 pr-3 pl-9 text-white"
        />
      </div>

      {(showHint || showEmpty || showResults || loading) && open ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/10 bg-zinc-950 shadow-lg">
          {loading ? (
            <p className="px-3 py-3 text-xs text-zinc-500">Searching…</p>
          ) : showHint ? (
            <p className="px-3 py-3 text-xs text-zinc-500">
              Type at least 2 characters
            </p>
          ) : showEmpty ? (
            <p className="px-3 py-3 text-xs text-zinc-500">No members found</p>
          ) : (
            results.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-0.5 border-b border-white/5 px-3 py-3 text-left last:border-0 hover:bg-white/5",
                  value?.email === member.email && "bg-amber-500/10"
                )}
              >
                <span className="text-sm text-white">
                  {member.displayName || member.email}
                </span>
                {member.displayName ? (
                  <span className="text-xs text-zinc-500">{member.email}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
