
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  KingIcon,
  QueenIcon,
  RookIcon,
  PawnIcon,
  BishopIcon,
  KnightIcon,
} from "@/components/icons/chess-icons";
import { Button } from "@/components/ui/button";
import { LogOut, School } from "lucide-react";

const menuItems = [
  { href: "/dashboard", icon: QueenIcon, label: "Dashboard" },
  { href: "/events", icon: RookIcon, label: "Events" },
  { href: "/players", icon: PawnIcon, label: "Players" },
  { href: "/schools", icon: School, label: "Schools" },
  { href: "/requests", icon: KnightIcon, label: "Change Requests" },
  { href: "/membership", icon: BishopIcon, label: "USCF Membership" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5"
              prefetch={false}
            >
              <KingIcon className="w-8 h-8 text-sidebar-primary" />
              <span className="font-headline text-2xl font-bold text-sidebar-foreground">
                ChessMate
              </span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.href)}
                    tooltip={{ children: item.label, side: "right" }}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="https://placehold.co/40x40.png" alt="@user" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                <p className="font-semibold text-sm truncate">Organizer</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  organizer@chessmate.com
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="group-data-[collapsible=icon]:w-10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
