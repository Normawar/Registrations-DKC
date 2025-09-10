
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service';
import Papa from 'papaparse';
import { format } from 'date-fns';

import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Search } from 'lucide-react';
import { type School } from '@/lib/data/school-data';
import { generateTeamCode } from '@/lib/school-utils';

type SchoolWithTeamCode = School & { id: string; teamCode: string };

function TeamCodesPageContent() {
  const { toast } = useToast();
  const [schools, setSchools] = useState<SchoolWithTeamCode[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');

  const loadSchools = useCallback(async () => {
    if (!db) return;
    setIsDataLoaded(false);
    try {
      const schoolsCol = collection(db, 'schools');
      const schoolSnapshot = await getDocs(schoolsCol);
      
      const schoolList = schoolSnapshot.docs.map(doc => {
        const data = doc.data() as School;
        return {
          ...data,
          id: doc.id,
          teamCode: generateTeamCode(data),
        };
      });
      
      setSchools(schoolList);
    } catch (error) {
      console.error("Failed to load schools:", error);
      toast({
        variant: 'destructive',
        title: 'Error Loading Data',
        description: 'Could not fetch the list of schools from the database.',
      });
    } finally {
      setIsDataLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);
  
  const uniqueDistricts = useMemo(() => {
    const districts = new Set(schools.map(s => s.district));
    return Array.from(districts).sort();
  }, [schools]);

  const filteredSchools = useMemo(() => {
    return schools.filter(school => {
      const lowerSearchTerm = searchTerm.toLowerCase();
      const matchesDistrict = districtFilter === 'all' || school.district === districtFilter;
      const matchesSearch = searchTerm.trim() === '' ||
        school.schoolName.toLowerCase().includes(lowerSearchTerm) ||
        school.district.toLowerCase().includes(lowerSearchTerm) ||
        school.teamCode.toLowerCase().includes(lowerSearchTerm);

      return matchesDistrict && matchesSearch;
    }).sort((a, b) => a.schoolName.localeCompare(b.schoolName));
  }, [schools, districtFilter, searchTerm]);

  const handleExport = () => {
    if (filteredSchools.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There are no schools matching the current filters.',
      });
      return;
    }

    const dataToExport = filteredSchools.map(s => ({
      'School Name': s.schoolName,
      'District': s.district,
      'Team Code': s.teamCode,
    }));
    
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `team_codes_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Export Successful',
      description: `Downloaded a list of ${filteredSchools.length} schools.`,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Team Code Directory</h1>
          <p className="text-muted-foreground">
            Search for schools and districts to find their official team codes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters & Export</CardTitle>
            <CardDescription>
              Use the filters to narrow down the list, then download the results.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="grid gap-1.5 flex-1 w-full sm:w-auto">
              <Label htmlFor="search-filter">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-filter"
                  placeholder="Search by School, District, or Team Code..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1.5 flex-1 w-full sm:w-auto">
              <Label htmlFor="district-filter">Filter by District</Label>
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger id="district-filter">
                  <SelectValue placeholder="Select a district..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {uniqueDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Download List ({filteredSchools.length})
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>School & Team Code List</CardTitle>
            <CardDescription>
              Displaying {filteredSchools.length} of {schools.length} total schools.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-2/5">School Name</TableHead>
                    <TableHead className="w-2/5">District</TableHead>
                    <TableHead className="w-1/5">Team Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!isDataLoaded && (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={3} className="p-0">
                          <div className="h-12 w-full bg-muted animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {isDataLoaded && filteredSchools.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        No schools found matching your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                  {isDataLoaded && filteredSchools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell className="font-medium">{school.schoolName}</TableCell>
                      <TableCell>{school.district}</TableCell>
                      <TableCell className="font-mono text-primary">{school.teamCode}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function TeamCodesPage() {
    return (
        <TeamCodesPageContent />
    )
}
