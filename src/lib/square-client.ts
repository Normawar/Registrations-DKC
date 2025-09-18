
import { Client, Environment } from 'square';

export async function getSquareClient(): Promise<Client> {
  // Hard-coded working values - exactly what works when you hard-code elsewhere
  return new Client({
    accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
    environment: Environment.Sandbox,
  });
}

export async function getSquareLocationId(): Promise<string> {
  return "CTED7GVSVH5H8";
}
