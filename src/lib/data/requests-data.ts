

export type ChangeRequest = {
  player: string;
  event: string;
  type: string;
  details: string;
  submitted: string;
  status: 'Pending' | 'Approved' | 'Denied';
};


export const requestsData: ChangeRequest[] = [
  { player: "Noah Williams", event: "Spring Open 2024", type: "Withdrawal", details: "Player is sick and cannot attend.", submitted: "2024-05-21", status: "Pending" },
  { player: "Sophia Martinez", event: "Summer Championship", type: "Substitution", details: "Sub for Carlos Garcia", submitted: "2024-05-20", status: "Pending" },
  { player: "John Doe", event: "Spring Open 2024", type: "Withdrawal", details: "", submitted: "2024-05-19", status: "Approved" },
  { player: "Jane Smith", event: "Autumn Classic", type: "Section Change", details: "Requesting move from K-8 to K-12 section.", submitted: "2024-05-18", status: "Pending" },
  { player: "Robert Brown", event: "Summer Championship", type: "Withdrawal", details: "Withdrawal requested after registration deadline.", submitted: "2024-05-17", status: "Denied" },
];
