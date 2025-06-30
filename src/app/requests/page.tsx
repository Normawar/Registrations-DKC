import { AppLayout } from "@/components/app-layout";
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
import { Badge } from "@/components/ui/badge";
import { requestsData } from "@/lib/data/requests-data";

export default function RequestsPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
          <p className="text-muted-foreground">
            View the status of player-submitted requests.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsData.map((request) => (
                  <TableRow key={`${request.player}-${request.submitted}`}>
                    <TableCell className="font-medium">{request.player}</TableCell>
                    <TableCell>{request.event}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>{request.details || '—'}</TableCell>
                    <TableCell>{request.submitted}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "Pending" ? "secondary" :
                          request.status === "Approved" ? "default" :
                          request.status === "Denied" ? "destructive" : "secondary"
                        }
                         className={request.status === 'Approved' ? 'bg-green-600 text-white' : ''}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
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
