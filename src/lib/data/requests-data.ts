

export type ChangeRequest = {
  id: string;
  confirmationId: string;
  player: string;
  event: string;
  eventDate?: string; // ISO String
  type: string;
  details: string;
  submitted: string; // ISO String
  submittedBy: string; // Name of sponsor/user who submitted
  status: 'Pending' | 'Approved' | 'Denied';
  approvedBy?: string; // Organizer's initials
  approvedAt?: string; // ISO String
  byeRound1?: string;
  byeRound2?: string;
};


export const requestsData: ChangeRequest[] = [
  { id: "req-1", confirmationId: "MOCK_INV_c9a1b2b3", player: "Noah Williams", event: "Spring Open 2024", type: "Withdrawal", details: "Player is sick and cannot attend.", submitted: "2024-05-21T10:00:00Z", submittedBy: "Sponsor A", status: "Pending" },
  { id: "req-2", confirmationId: "MOCK_INV_d4e5f6g7", player: "Sophia Martinez", event: "Summer Championship", type: "Substitution", details: "Sub for Carlos Garcia", submitted: "2024-05-20T11:00:00Z", submittedBy: "Sponsor B", status: "Pending" },
  { id: "req-3", confirmationId: "MOCK_INV_h8i9j0k1", player: "John Doe", event: "Spring Open 2024", type: "Withdrawal", details: "", submitted: "2024-05-19T12:00:00Z", submittedBy: "Sponsor C", status: "Approved", approvedBy: "DK", approvedAt: "2024-05-19T12:05:00Z" },
  { id: "req-4", confirmationId: "MOCK_INV_l2m3n4o5", player: "Jane Smith", event: "Autumn Classic", type: "Section Change", details: "Requesting move from K-8 to K-12 section.", submitted: "2024-05-18T13:00:00Z", submittedBy: "Sponsor A", status: "Pending" },
  { id: "req-5", confirmationId: "MOCK_INV_p6q7r8s9", player: "Robert Brown", event: "Summer Championship", type: "Withdrawal", details: "Withdrawal requested after registration deadline.", submitted: "2024-05-17T14:00:00Z", submittedBy: "Sponsor D", status: "Denied", approvedBy: "DK", approvedAt: "2024-05-17T14:10:00Z" },
];

    
