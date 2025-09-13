
'use client';

import { useMemo } from 'react';
import { AppLayout } from '@/components/app-layout';
import { OrganizerGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMasterDb } from '@/context/master-db-context';
import { generateTeamCode } from '@/lib/school-utils';
import { MasterPlayer } from '@/lib/data/full-master-player-data';

const targetTeamCodes = ['PHACANT', 'PHAGARZ', 'PHGPALM', 'PHJMCKE', 'PHKENN'];

type GroupedPlayers = {
  [teamCode: string]: {
    schoolName: string;
    district: string;
    players: MasterPlayer[];
  };
};

function TeamCodeReportContent() {
  const { database: allPlayers, isDbLoaded } = useMasterDb();

  const groupedPlayers = useMemo(() => {
    if (!isDbLoaded) return {};

    const filtered = allPlayers.filter(player => {
      const teamCode = generateTeamCode(player);
      return targetTeamCodes.includes(teamCode);
    });

    return filtered.reduce((acc, player) => {
      const teamCode = generateTeamCode(player);
      if (!acc[teamCode]) {
        acc[teamCode] = {
          schoolName: player.school,
          district: player.district,
          players: [],
        };
      }
      acc[teamCode].players.push(player);
      return acc;
    }, {} as GroupedPlayers);
  }, [allPlayers, isDbLoaded]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Specific Team Code Report</h1>
        <p className="text-muted-foreground">
          Showing student rosters for the requested team codes.
        </p>
      </div>

      {Object.keys(groupedPlayers).length === 0 && isDbLoaded ? (
        <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
                No players found for the specified team codes.
            </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
            {targetTeamCodes.map(teamCode => {
                const group = groupedPlayers[teamCode];
                if (!group) return null;

                return (
                    <Card key={teamCode}>
                        <CardHeader>
                            <CardTitle>{group.schoolName}</CardTitle>
                            <CardDescription>Team Code: <span className="font-mono font-semibold">{teamCode}</span> | District: {group.district}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Player Name</TableHead>
                                            <TableHead>Grade</TableHead>
                                            <TableHead>USCF ID</TableHead>
                                            <TableHead>Rating</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.players.sort((a,b) => (a.lastName || '').localeCompare(b.lastName || '')).map(player => (
                                            <TableRow key={player.id}>
                                                <TableCell>{player.firstName} {player.lastName}</TableCell>
                                                <TableCell>{player.grade || 'N/A'}</TableCell>
                                                <TableCell>{player.uscfId}</TableCell>
                                                <TableCell>{player.regularRating || 'UNR'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
      )}
    </div>
  );
}

export default function TeamCodeReportPage() {
  return (
    <OrganizerGuard>
      <AppLayout>
        <TeamCodeReportContent />
      </AppLayout>
    </OrganizerGuard>
  );
}
