

export type ChangeRequest = {
  confirmationId: string;
  player: string;
  event: string;
  type: string;
  details: string;
  submitted: string;
  status: 'Pending' | 'Approved' | 'Denied';
};


export const requestsData: ChangeRequest[] = [
  { confirmationId: "MOCK_INV_c9a1b2b3", player: "Noah Williams", event: "Spring Open 2024", type: "Withdrawal", details: "Player is sick and cannot attend.", submitted: "2024-05-21", status: "Pending" },
  { confirmationId: "MOCK_INV_d4e5f6g7", player: "Sophia Martinez", event: "Summer Championship", type: "Substitution", details: "Sub for Carlos Garcia", submitted: "2024-05-20", status: "Pending" },
  { confirmationId: "MOCK_INV_h8i9j0k1", player: "John Doe", event: "Spring Open 2024", type: "Withdrawal", details: "", submitted: "2024-05-19", status: "Approved" },
  { confirmationId: "MOCK_INV_l2m3n4o5", player: "Jane Smith", event: "Autumn Classic", type: "Section Change", details: "Requesting move from K-8 to K-12 section.", submitted: "2024-05-18", status: "Pending" },
  { confirmationId: "MOCK_INV_p6q7r8s9", player: "Robert Brown", event: "Summer Championship", type: "Withdrawal", details: "Withdrawal requested after registration deadline.", submitted: "2024-05-17", status: "Denied" },
];
