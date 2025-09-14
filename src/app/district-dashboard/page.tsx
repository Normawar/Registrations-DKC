
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
import { useState, useMemo, useEffect, useCallback } from "react";
import { Building, Users, FileText, Award } from 'lucide-react';
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DistrictCoordinatorGuard } from "@/components/auth-guard";
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import { MasterPlayer } from '@/lib/data/full-master-player-data';


function DistrictDashboardContent() {
  console.log('🏢 DISTRICT DASHBOARD CONTENT LOADED');
  const { profile } = useSponsorProfile();
  const [clientReady, setClientReady] = useState(false);
  const [districtPlayers, setDistrictPlayers] = useState<MasterPlayer[]>([]);

  useEffect(() => {
    setClientReady(true);
  }, []);
  
  const loadDistrictPlayers = useCallback(async () => {
    if (!profile?.district || !db) return;
    const playersQuery = query(collection(db, 'players'), where('district', '==', profile.district));
    const querySnapshot = await getDocs(playersQuery);
    const players = querySnapshot.docs.map(doc => doc.data() as MasterPlayer);
    setDistrictPlayers(players);
  }, [profile?.district]);

  useEffect(() => {
    loadDistrictPlayers();
  }, [loadDistrictPlayers]);


  const districtSchools = useMemo(() => {
    if (!profile?.district) return [];
    const schools = districtPlayers
      .map(p => p.school)
      .filter((school): school is string => !!school); 
    return [...Array.from(new Set(schools))].sort();
  }, [districtPlayers, profile?.district]);

  const districtStats = useMemo(() => {
    if (!profile?.district) return { totalPlayers: 0, totalSchools: 0, totalGtPlayers: 0 };
    return {
        totalPlayers: districtPlayers.length,
        totalSchools: districtSchools.length,
        totalGtPlayers: districtPlayers.filter(p => p.studentType === 'gt').length
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
             {profile?.district === 'PHARR-SAN JUAN-ALAMO ISD' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">GT Players</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {clientReady ? (
                            <div className="text-2xl font-bold">{districtStats.totalGtPlayers}</div>
                        ) : <Skeleton className="h-8 w-1/2" />}
                        <p className="text-xs text-muted-foreground">identified as Gifted & Talented</p>
                    </CardContent>
                </Card>
            )}
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

export default function DistrictDashboardPage() {
    console.log('🏢 DISTRICT DASHBOARD PAGE COMPONENT LOADED');
    return (
        <DistrictCoordinatorGuard>
            <DistrictDashboardContent />
        </DistrictCoordinatorGuard>
    );
}
