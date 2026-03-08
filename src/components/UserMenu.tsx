'use client';

import { useAuth } from '@/app/providers';
import { LogIn, LogOut, Cloud, User } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors text-xs text-slate-400"
      >
        <LogIn className="w-3.5 h-3.5" />
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#111827] border border-slate-800 hover:border-slate-600 transition-colors"
      >
        <User className="w-4 h-4 text-slate-400" />
        <Cloud className="w-3.5 h-3.5 text-green-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-56 bg-[#111827] border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-sm font-medium text-white truncate">
                {user.email}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Cloud className="w-3 h-3 text-green-400" />
                <span className="text-xs text-green-400">Synced to cloud</span>
              </div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
