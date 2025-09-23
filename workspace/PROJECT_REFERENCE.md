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
All database writes, payments, and sensitive operations MUST occur in Server Actions or API Routes. NO direct client-side access to Firebase services (except for the `useMasterDb` read-only context).

```typescript
// ✅ Correct: Server Actions or API Routes
'use server';
export async function serverAction(data: FormData) {
  // Database queries and business logic here
}

// ❌ Wrong: Client-side database access
import { db } from '@/lib/services/firestore-service'; // Don't import db on client for writes
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
Due to environment initialization issues, the Square client **MUST** be instantiated directly inside the server action or flow that uses it. **DO NOT** use a shared client instance.

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

// ❌ Wrong: Using a shared/imported client
import { getSquareClient } from '@/lib/square-client';
const client = getSquareClient(); // This pattern has failed and is forbidden.
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

## Firebase Integration

### ✅ Reliable Firebase Admin SDK Pattern (CRITICAL)
The Firebase Admin SDK has proven to be unreliable when initialized at the module level in this environment. It **MUST** be initialized just-in-time using the getter functions from `firebase-admin.ts`.

```typescript
// ✅ Correct: Use the getter function inside the server action
'use server';
import { getDb, getAdminAuth } from '@/lib/firebase-admin';

export async function myDbAction() {
  const db = getDb(); // Get instance just-in-time
  const auth = getAdminAuth();
  
  // Now you can safely use db and auth
  await db.collection('users').get();
}

// ❌ Wrong: Importing the instance directly
import { db } from '@/lib/firebase-admin'; // FORBIDDEN: This will be null/undefined
```

### Module Import Rules (Critical)
- **`'use server'` files**: MUST import from `@/lib/firebase-admin`.
- **`'use client'` files**: MUST import from `@/lib/firebase` or `@/lib/services/firestore-service`.
- **NEVER** mix these imports. A server file must never import the client SDK, and a client file must never import the admin SDK.

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
- **Direct import of `db` or `adminAuth` will fail.** Always use the `getDb()` and `getAdminAuth()` functions inside your server-side code.
- Private key formatting is critical. Newlines must be properly escaped (`\\n`).

### Build Errors
- Never import server-side packages (e.g., `firebase-admin`) in client code.
- Use `'use server'` directive for all server actions and Genkit flows.
- Verify `lucide-react` icons exist before using.
```