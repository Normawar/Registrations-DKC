
import { AppLayout } from "@/components/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  RookIcon,
  PawnIcon,
} from "@/components/icons/chess-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

const rosterPlayers = [
    { id: "1", firstName: "Alex", lastName: "Ray", email: 'alex.ray@example.com', rating: 1850 },
    { id: "2", firstName: "Jordan", lastName: "Lee", email: 'jordan.lee@example.com', rating: 2100 },
    { id: "3", firstName: "Casey", lastName: "Becker", email: 'casey.becker@example.com', rating: 1500 },
    { id: "4", firstName: "Morgan", lastName: "Taylor", email: 'morgan.taylor@example.com', rating: 1720 },
    { id: "5", firstName: "Riley", lastName: "Quinn", email: 'riley.quinn@example.com', rating: 1980 },
    { id: "6", firstName: "Skyler", lastName: "Jones", email: 'skyler.jones@example.com', rating: 1650 },
    { id: "7", firstName: "Drew", lastName: "Smith", email: 'drew.smith@example.com', rating: 2050 },
];

const upcomingEvents = [
  { id: "1", name: "Spring Open 2024", date: "June 15, 2024", pendingRequests: 2 },
  { id: "2", name: "Summer Championship", date: "July 20, 2024", pendingRequests: 3 },
  { id: "3", name: "Autumn Classic", date: "September 10, 2024", pendingRequests: 0 },
];


export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Sponsors Dashboard</h1>
          <p className="text-muted-foreground">
            An overview of your sponsored activities.
          </p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events ({upcomingEvents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                    {event.pendingRequests > 0 ? (
                      <Button asChild variant="link" className="p-0 h-auto text-primary">
                        <Link href="/requests">
                          {event.pendingRequests} pending request{event.pendingRequests !== 1 ? 's' : ''}
                        </Link>
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">No pending requests</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>My Roster ({rosterPlayers.length})</CardTitle>
            <CardDescription>A quick view of your sponsored players. Scroll to see more.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterPlayers.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={`https://placehold.co/40x40.png`} alt={`${player.firstName} ${player.lastName}`} />
                            <AvatarFallback>{player.firstName.charAt(0)}{player.lastName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{player.lastName}, {player.firstName}</div>
                            <div className="text-sm text-muted-foreground">
                              {player.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{player.rating}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/roster">View & Manage Full Roster</Link>
            </Button>
          </CardFooter>
        </Card>

        <div>
          <h2 className="text-2xl font-bold font-headline">Recent Activity</h2>
          <Card className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Liam Johnson</div>
                    <div className="text-sm text-muted-foreground">
                      liam@example.com
                    </div>
                  </TableCell>
                  <TableCell>Spring Open 2024</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Registered</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-23</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Olivia Smith</div>
                    <div className="text-sm text-muted-foreground">
                      olivia@example.com
                    </div>
                  </TableCell>
                  <TableCell>Summer Championship</TableCell>
                  <TableCell>
                    <Badge variant="outline">Paid</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-22</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="font-medium">Noah Williams</div>
                    <div className="text-sm text-muted-foreground">
                      noah@example.com
                    </div>
                  </TableCell>
                  <TableCell>Spring Open 2024</TableCell>
                  <TableCell>
                    <Badge variant="destructive">Withdrew</Badge>
                  </TableCell>
                  <TableCell className="text-right">2024-05-21</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
