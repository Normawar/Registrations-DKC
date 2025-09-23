# Comprehensive Project Reference

## Tech Stack & Architecture Requirements

### Predefined Tech Stack
- **Framework**: Next.js (App Router)
- **Frontend**: React + TypeScript
- **UI Components**: ShadCN UI (exclusive component library)
- **Styling**: Tailwind CSS (no other CSS frameworks)
- **Icons**: lucide-react (verify icon exists before use)
- **Backend**: Firebase (Firestore + Authentication)
- **AI Library**: Genkit (exclusive for all AI functionality)

### Development Environment
- **Deployment**: Firebase Studio + App Hosting
- **Production Domain**: register.dkchess.com
- **Build System**: Firebase App Hosting with `apphosting.yaml`

## Critical Architecture Rules

### Server-Side Logic (Strict Requirement)
All database writes, payments, and sensitive operations MUST occur in Server Actions or API Routes. 

```typescript
// ✅ Correct: Server Actions or API Routes
'use server';
export async function serverAction(data: FormData) {
  // Database queries and business logic here
}
```

### Hydration Error Prevention
```typescript
// ✅ Correct: Client-side only code
useEffect(() => {
  // Browser APIs, Math.random, new Date() here
  setClientData(Math.random());
}, []);

// ❌ Wrong: Server/client mismatch
const randomValue = Math.random(); // Different on server vs client
```

### Data Management Pattern
```typescript
// Centralized data provider pattern
const { schools, districts } = useMasterDb(); // Global data access for client-side reads

// All data writes MUST use server actions.
```

## Square API Integration (Production)

### Working Credentials
```typescript
accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC"
environment: Environment.Production
locationId: "CTED7GVSVH5H8"
applicationId: "sq0idp-2nOEj3tUd-PtlED-EdE3MQ"
```

### ✅ Reliable Square Client Pattern (CRITICAL)
Due to environment initialization issues, the Square client **MUST** be instantiated directly inside the server action or flow that uses it. **DO NOT** use a shared client instance from `square-client.ts`.

```typescript
// ✅ Correct: Initialize inside the server action
'use server';
import { Client, Environment } from 'square';

export async function mySquareAction(input: any) {
  const squareClient = new Client({
    accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
    environment: Environment.Production,
  });
  
  // ... use squareClient here
}

// ❌ Wrong: Using a shared/imported client is forbidden.
```

## Firebase Integration

### ✅ Critical Exception: Firestore Write Pattern
Due to persistent and unresolvable initialization failures of the `firebase-admin` SDK in this specific deployment environment, a critical exception to the server-side logic rule is required for database writes.

- **For most Server Actions (especially invoice creation), use the client-side SDK**: Import the client `db` instance from `@/lib/services/firestore-service`. This pattern has proven to be the only reliable method for Firestore writes in this environment.

```typescript
// ✅ Correct (Required Exception): Using CLIENT SDK in a Server Action
'use server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/services/firestore-service'; // Import client DB

export async function createInvoiceAction(data: any) {
  const invoiceRef = doc(db, 'invoices', data.id);
  await setDoc(invoiceRef, data); // This works
}
```

- **Admin SDK for Admin-Only Tasks**: The `firebase-admin` SDK (via `getDb()` and `getAdminAuth()` from `@/lib/firebase-admin`) should ONLY be used for operations that absolutely require admin privileges, such as user management in `src/app/users/actions.ts`. For all other database operations in server actions, use the client SDK pattern above.

### Module Import Rules (Critical)
- **`'use server'` files for INVOICES/PAYMENTS**: MUST import `db` from `@/lib/services/firestore-service`.
- **`'use server'` files for USER MANAGEMENT**: MUST import from `@/lib/firebase-admin`.
- **`'use client'` files**: MUST import from `@/lib/firebase` or `@/lib/services/firestore-service`.
- **NEVER** import `@/lib/firebase-admin` in a client component.

### User Deletion (Force Delete)
```typescript
'use server';
import { getDb, getAdminAuth } from '@/lib/firebase-admin';

export async function forceDeleteUser(userId: string) {
  const db = getDb();
  const auth = getAdminAuth();
  
  // Must delete from BOTH:
  // 1. Firestore database
  await db.collection('users').doc(userId).delete();
  
  // 2. Firebase Authentication
  await auth.deleteUser(userId);
}
```

## Genkit AI Implementation

### Flow Structure (Required Pattern)
```typescript
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({ /* ... */ });
const OutputSchema = z.object({ /* ... */ });

export type FlowInput = z.infer<typeof InputSchema>;
export type FlowOutput = z.infer<typeof OutputSchema>;

// Note: For simple database/API actions, a standard Server Action is preferred.
// Use Genkit flows when LLM interaction is required.
const myFlow = ai.defineFlow(
  {
    name: 'myFlowName',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => { /* Flow logic here */ }
);

// Export wrapper function
export async function executeFlow(input: FlowInput): Promise<FlowOutput> {
  return myFlow(input);
}
```

### Prompt Structure (Handlebars Required)
```typescript
const myPrompt = ai.definePrompt(
  {
    name: 'myPrompt',
    inputSchema: z.object({ name: z.string() }),
  },
  'Hello {{name}}, how can I help you?' // Handlebars syntax only
);
```

## UI Component Patterns

### ShadCN Component Usage
```typescript
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction } from '@/components/ui/alert-dialog';

// Replace browser confirm() with AlertDialog
const confirmDelete = () => {
  // Use AlertDialog component instead of confirm()
};
```

### Server Action Button Pattern
```typescript
import { useTransition } from 'react';

function MyComponent() {
  const [isPending, startTransition] = useTransition();
  
  const handleSubmit = () => {
    startTransition(async () => {
      await serverAction(formData);
    });
  };
  
  return (
    <Button disabled={isPending}>
      {isPending ? 'Loading...' : 'Submit'}
    </Button>
  );
}
```

## Production Deployment

### apphosting.yaml (Required Format)
```yaml
runConfig:
  cpu: 1
  memoryMiB: 512
```

## Critical Debugging Lessons

### Square API
- Token/environment must match (`production` token = `Environment.Production`).
- **Hard-coded client initialization inside server actions is the only reliable pattern.**

### Firebase Admin SDK
- **Direct import of `db` or `adminAuth` will fail.** Always use the `getDb()` and `getAdminAuth()` functions inside your server-side code for admin-only tasks.
- For most database operations in server actions, use the client SDK as per the exception documented above.

### Build Errors
- Never import server-side packages (e.g., `firebase-admin`) in client code.
- Use `'use server'` directive for all server actions and Genkit flows.
- Verify `lucide-react` icons exist before using.
```