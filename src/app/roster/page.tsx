import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
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
import { PlusCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const rosterPlayers = [
  { name: "Alex Ray", uscfId: "12345678", rating: 1850, school: "North High School" },
  { name: "Jordan Lee", uscfId: "87654321", rating: 2100, school: "City Chess Club" },
];

export default function RosterPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Roster</h1>
            <p className="text-muted-foreground">
              Manage your sponsored player roster.
            </p>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Player to Roster
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>USCF ID</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>School</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rosterPlayers.map((player) => (
                  <TableRow key={player.uscfId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://placehold.co/40x40.png`} alt={player.name} data-ai-hint="person" />
                          <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        {player.name}
                      </div>
                    </TableCell>
                    <TableCell>{player.uscfId}</TableCell>
                    <TableCell>{player.rating}</TableCell>
                    <TableCell>{player.school}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
