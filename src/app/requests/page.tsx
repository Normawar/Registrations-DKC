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
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

const requests = [
  { player: "Noah Williams", event: "Spring Open 2024", type: "Withdrawal", submitted: "2024-05-21", status: "Pending" },
  { player: "Sophia Martinez", event: "Summer Championship", type: "Substitution", submitted: "2024-05-20", status: "Pending", details: "Sub for Carlos Garcia" },
  { player: "John Doe", event: "Spring Open 2024", type: "Withdrawal", submitted: "2024-05-19", status: "Approved" },
  { player: "Jane Smith", event: "Autumn Classic", type: "Section Change", submitted: "2024-05-18", status: "Pending" },
  { player: "Robert Brown", event: "Summer Championship", type: "Withdrawal", submitted: "2024-05-17", status: "Denied" },
];

export default function RequestsPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Change Requests</h1>
          <p className="text-muted-foreground">
            Approve or deny player-submitted requests.
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
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={`${request.player}-${request.submitted}`}>
                    <TableCell className="font-medium">{request.player}</TableCell>
                    <TableCell>{request.event}</TableCell>
                    <TableCell>{request.type}</TableCell>
                    <TableCell>{request.submitted}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "Pending" ? "destructive" :
                          request.status === "Approved" ? "default" : "secondary"
                        }
                         className={request.status === 'Approved' ? 'bg-green-600' : ''}
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "Pending" && (
                        <div className="flex gap-2 justify-end">
                          <Button size="icon" variant="outline" className="h-8 w-8 bg-green-100 hover:bg-green-200 text-green-700 border-green-300">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 bg-red-100 hover:bg-red-200 text-red-700 border-red-300">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
