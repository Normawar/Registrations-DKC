
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
  Wrench,
} from "@/components/icons/chess-icons";
import { Button } from "@/components/ui/button";
import { User, LogOut, School, ClipboardCheck, Users } from "lucide-react";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { generateTeamCode } from "@/lib/school-utils";

const menuItems = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/dashboard", icon: QueenIcon, label: "Dashboard" },
  { href: "/roster", icon: PawnIcon, label: "Roster" },
  { href: "/events", icon: RookIcon, label: "Register for event" },
  { href: "/confirmations", icon: ClipboardCheck, label: "Confirmations" },
  { href: "/schools", icon: School, label: "Schools" },
  { href: "/players", icon: Users, label: "All Players" },
  { href: "/manage-events", icon: Wrench, label: "Manage Events" },
  { href: "/requests", icon: KnightIcon, label: "Change Requests" },
  { href: "/membership", icon: BishopIcon, label: "USCF Membership" },
];

const icons: { [key: string]: React.ElementType } = {
  KingIcon,
  QueenIcon,
  RookIcon,
  BishopIcon,
  KnightIcon,
  PawnIcon,
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useSponsorProfile();

  const AvatarComponent = profile && profile.avatarType === 'icon' ? icons[profile.avatarValue] : null;
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
                <Link href="/profile" prefetch={false} aria-label="Sponsor Profile">
                    {profile?.avatarType === 'upload' ? (
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatarValue} alt="Sponsor Avatar" />
                            <AvatarFallback>{profile.firstName.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ) : AvatarComponent ? (
                        <AvatarComponent className="w-8 h-8 text-sidebar-primary shrink-0" />
                    ) : (
                        <KingIcon className="w-8 h-8 text-sidebar-primary shrink-0" />
                    )}
                </Link>
                <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                    <p className="font-headline text-base font-bold text-sidebar-foreground truncate">
                        {profile ? `${profile.firstName} ${profile.lastName}` : 'Sponsor Name'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/80 truncate">
                        {profile ? profile.school : 'School Name'}
                    </p>
                    <p className="text-xs text-sidebar-foreground/70 truncate">
                        {profile ? profile.district : 'District Name'}
                    </p>
                    {teamCode && (
                      <p className="text-xs font-bold text-sidebar-primary truncate font-mono">
                        {teamCode}
                      </p>
                    )}
                </div>
            </div>
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
                {profile?.avatarType === 'upload' ? (
                  <AvatarImage src={profile.avatarValue} alt="@user" />
                ) : null }
                <AvatarFallback>{profile ? profile.firstName.charAt(0) : 'S'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                <p className="font-semibold text-sm truncate">{profile ? `${profile.firstName} ${profile.lastName}` : 'Sponsor'}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  {profile ? profile.email : 'sponsor@chessmate.com'}
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
