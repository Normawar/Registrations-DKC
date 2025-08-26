
'use client';

import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSponsorProfile } from "@/hooks/use-sponsor-profile";
import { useMasterDb } from "@/context/master-db-context";
import { useState, useMemo, useEffect } from "react";
import { Building, Users, FileText } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export default function DistrictDashboardPage() {
  const { profile } = useSponsorProfile();
  const { database: allPlayers } = useMasterDb();
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const districtPlayers = useMemo(() => {
    if (!profile?.district) return [];
    return allPlayers.filter(p => p.district === profile.district);
  }, [allPlayers, profile?.district]);
  
  const districtSchools = useMemo(() => {
    if (!profile?.district) return [];
    const schools = districtPlayers
      .map(p => p.school)
      .filter((school): school is string => !!school); 
    return [...Array.from(new Set(schools))].sort();
  }, [districtPlayers, profile?.district]);

  const districtStats = useMemo(() => {
    if (!profile?.district) return { totalPlayers: 0, totalSchools: 0 };
    return {
        totalPlayers: districtPlayers.length,
        totalSchools: districtSchools.length,
    };
  }, [districtPlayers, districtSchools, profile?.district]);


  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">District Coordinator Dashboard</h1>
          <p className="text-muted-foreground">
            An overview of your entire district: {profile?.district}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Schools</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {clientReady ? (
                        <div className="text-2xl font-bold">{districtStats.totalSchools}</div>
                    ) : <Skeleton className="h-8 w-1/2" />}
                    <p className="text-xs text-muted-foreground">in {profile?.district}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {clientReady ? (
                        <div className="text-2xl font-bold">{districtStats.totalPlayers}</div>
                    ) : <Skeleton className="h-8 w-1/2" />}
                    <p className="text-xs text-muted-foreground">across all schools in the district</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex flex-col space-y-2">
                   <Button asChild variant="outline" size="sm"><Link href="/invoices">View District Invoices</Link></Button>
                   <Button asChild variant="outline" size="sm"><Link href="/requests">View District Requests</Link></Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </AppLayout>
  );
}
