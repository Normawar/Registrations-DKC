
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  SidebarMenuBadge,
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
import { User, LogOut, ClipboardCheck, Receipt, FolderKanban, School, PlusCircle, History, Users, ShieldCheck, LayoutDashboard } from "lucide-react";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { generateTeamCode } from "@/lib/school-utils";
import { useState, useEffect, useMemo } from 'react';
import type { ChangeRequest } from '@/lib/data/requests-data';


const sponsorMenuItems = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/dashboard", icon: QueenIcon, label: "Dashboard" },
  { href: "/roster", icon: PawnIcon, label: "Roster" },
  { href: "/events", icon: RookIcon, label: "Register for event" },
  { href: "/invoices", icon: Receipt, label: "Invoices & Payments" },
  { href: "/requests", icon: KnightIcon, label: "Change Requests" },
  { href: "/membership", icon: BishopIcon, label: "USCF Membership ONLY" },
  { href: "/previous-events", icon: History, label: "Previous Events" },
];

const districtCoordinatorMenuItems = [
    { href: "/profile", icon: User, label: "Profile" },
    { href: "/district-dashboard", icon: LayoutDashboard, label: "District Dashboard" },
    { href: "/events", icon: RookIcon, label: "Register for event" },
    { href: "/invoices", icon: Receipt, label: "District Invoices" },
    { href: "/requests", icon: KnightIcon, label: "District Requests" },
    { href: "/membership", icon: BishopIcon, label: "USCF Membership ONLY" },
    { href: "/previous-events", icon: History, label: "Previous Events" },
];

const organizerMenuItems = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/manage-events", icon: FolderKanban, label: "Manage Events" },
  { href: "/payment-authorization", icon: ShieldCheck, label: "Payment Authorization" },
  { href: "/players", icon: PawnIcon, label: "Master Player Database" },
  { href: "/schools", icon: School, label: "Schools & Districts" },
  { href: "/users", icon: Users, label: "User Management" },
  { href: "/invoices", icon: Receipt, label: "All Invoices" },
  { href: "/organizer-invoice", icon: PlusCircle, label: "Create Custom Invoice" },
  { href: "/events", icon: RookIcon, label: "Upcoming Events" },
  { href: "/membership", icon: BishopIcon, label: "Purchase USCF Membership" },
  { href: "/requests", icon: KnightIcon, label: "Change Requests" },
  { href: "/previous-events", icon: History, label: "Previous Events" },
];

const individualMenuItems = [
  { href: "/profile", icon: User, label: "Profile" },
  { href: "/individual-dashboard", icon: QueenIcon, label: "Dashboard" },
  { href: "/events", icon: RookIcon, label: "Register for event" },
  { href: "/invoices", icon: Receipt, label: "Invoices & Payments" },
  { href: "/membership", icon: BishopIcon, label: "USCF Membership ONLY" },
  { href: "/previous-events", icon: History, label: "Previous Events" },
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
  const router = useRouter();
  const { profile } = useSponsorProfile();
  
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);

  useEffect(() => {
      const loadData = () => {
        try {
            const storedRequests = localStorage.getItem('change_requests');
            setChangeRequests(storedRequests ? JSON.parse(storedRequests) : []);
            
            const storedConfirmations = localStorage.getItem('confirmations');
            setConfirmations(storedConfirmations ? JSON.parse(storedConfirmations) : []);
        } catch (error) {
            console.error("Failed to load data for sidebar notifications:", error);
            setChangeRequests([]);
            setConfirmations([]);
        }
      };

      loadData();
      // Listen for changes from other tabs.
      window.addEventListener('storage', loadData);
      return () => {
          window.removeEventListener('storage', loadData);
      };
  }, []);

  const pendingRequestsCount = useMemo(() => {
    if (!profile) return 0;
    
    if (profile.role === 'organizer') {
        return changeRequests.filter(r => r.status === 'Pending').length;
    }
    
    if (profile.role === 'sponsor' && profile.isDistrictCoordinator) {
        const districtConfirmationIds = new Set(confirmations
            .filter(c => c.district === profile.district)
            .map(c => c.id));
        return changeRequests.filter(req => req.status === 'Pending' && districtConfirmationIds.has(req.confirmationId)).length;
    }

    if (profile.role === 'sponsor') {
        const sponsorConfirmationIds = new Set(confirmations
            .filter(c => c.schoolName === profile.school && c.district === profile.district)
            .map(c => c.id));
        
        return changeRequests.filter(req => req.status === 'Pending' && sponsorConfirmationIds.has(req.confirmationId)).length;
    }
    
    return 0;
  }, [profile, changeRequests, confirmations]);

  const pendingPaymentsCount = useMemo(() => {
    if (profile?.role !== 'organizer') return 0;
    return confirmations.filter(c => c.paymentStatus === 'pending-po').length;
  }, [profile, confirmations]);

  const handleLogout = () => {
    localStorage.removeItem('current_user_profile');
    // We dispatch a storage event so all tabs know to log out.
    window.dispatchEvent(new Event('storage'));
    router.push('/');
  };

  const menuItems = 
    profile?.role === 'organizer' ? organizerMenuItems :
    profile?.role === 'individual' ? individualMenuItems :
    profile?.isDistrictCoordinator ? districtCoordinatorMenuItems :
    sponsorMenuItems;

  const AvatarComponent = profile && profile.avatarType === 'icon' ? icons[profile.avatarValue] : null;
  const teamCode = profile ? generateTeamCode({ schoolName: profile.school, district: profile.district }) : null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
                <Link href="/profile" prefetch={false} aria-label="Profile">
                    {profile?.avatarType === 'upload' ? (
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatarValue} alt="User Avatar" />
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
                        {profile ? `${profile.firstName} ${profile.lastName}` : 'User Name'}
                    </p>
                    {profile?.role === 'sponsor' && (
                      <>
                        <p className="text-xs text-sidebar-foreground/80 truncate">
                            {profile.isDistrictCoordinator ? `${profile.district} Coordinator` : profile.school || 'School Name'}
                        </p>
                        {teamCode && !profile.isDistrictCoordinator && (
                          <p className="text-xs font-bold text-sidebar-primary truncate font-mono">
                            {teamCode}
                          </p>
                        )}
                      </>
                    )}
                    {profile?.role === 'organizer' && (
                        <p className="text-xs text-sidebar-primary truncate font-semibold">
                            Organizer
                        </p>
                    )}
                    {profile?.role === 'individual' && (
                        <p className="text-xs text-sidebar-primary truncate font-semibold">
                            Individual Player
                        </p>
                    )}
                </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                let badgeCount = 0;
                if (item.href === '/requests') {
                  badgeCount = pendingRequestsCount;
                } else if (item.href === '/payment-authorization') {
                  badgeCount = pendingPaymentsCount;
                }

                return (
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
                    {badgeCount > 0 && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                        {badgeCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {profile?.avatarType === 'upload' ? (
                  <AvatarImage src={profile.avatarValue} alt="@user" />
                ) : null }
                <AvatarFallback>{profile ? profile.firstName.charAt(0) : 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
                <p className="font-semibold text-sm truncate">{profile ? `${profile.firstName} ${profile.lastName}` : 'User'}</p>
                <p className="text-xs text-sidebar-foreground/70 truncate">
                  {profile ? profile.email : 'user@chessmate.com'}
                </p>
              </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="group-data-[collapsible=icon]:w-10"
                    aria-label="Log out"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
