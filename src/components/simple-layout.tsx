"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Home, Search, FileText, Calendar } from "lucide-react";

const navItems = [{ href: "/players", icon: Search, label: "Search Players" },
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  
  { href: "/roster", icon: Users, label: "Roster" },
  { href: "/manage-events", icon: Calendar, label: "Manage Events" },
  { href: "/invoices", icon: FileText, label: "Invoices" },
];

export function SimpleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-gray-800 text-white p-4">
        <div className="flex gap-4 flex-wrap">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                pathname === item.href ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="flex-1 p-4">
        {children}
      </main>
    </div>
  );
}
