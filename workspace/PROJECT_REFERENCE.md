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
```typescript
// ✅ Correct: Server Actions or API Routes
'use server';
export async function serverAction(data: FormData) {
  // Database queries and business logic here
}

// ❌ Wrong: Client-side database access
import { db } from '@/lib/firestore'; // Don't import db on client
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
const { schools, districts } = useMasterDb(); // Global data access
// Data fetched via server-side API routes only
```

## Square API Integration (Production)

### Working Credentials
```typescript
accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC"
environment: Environment.Production
locationId: "CTED7GVSVH5H8"
applicationId: "sq0idp-2nOEj3tUd-PtlED-EdE3MQ"
```

### Reliable Square Client Pattern
```typescript
// Use this pattern in all Square-related flows
import { Client, Environment } from 'square';

const squareClient = new Client({
  accessToken: "EAAAl7QTGApQ59SrmHVdLlPWYOMIEbfl0ZjmtCWWL4_hm4r4bAl7ntqxnfKlv1dC",
  environment: Environment.Production,
});
```

### Current Implementation Files
- ✅ `src/ai/flows/create-invoice-flow.ts` (working with hard-coded approach)
- ✅ `src/ai/flows/cancel-invoice-flow.ts` (working with hard-coded approach)
- ❌ `src/config/square-config.ts` (bypassed due to Firebase Studio env issues)

## Genkit AI Implementation

### Flow Structure (Required Pattern)
```typescript
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const InputSchema = z.object({
  // Zod validation schema
});

const OutputSchema = z.object({
  // Zod validation schema  
});

export type FlowInput = z.infer<typeof InputSchema>;
export type FlowOutput = z.infer<typeof OutputSchema>;

const myFlow = ai.defineFlow(
  {
    name: 'myFlowName',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    // Flow logic here
    return result;
  }
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

### Tool Implementation
```typescript
const myTool = ai.defineTool(
  {
    name: 'myTool',
    description: 'What this tool does',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ result: z.string() }),
  },
  async (input) => {
    // Tool logic for LLM to use during reasoning
    return { result: 'data' };
  }
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

### Icon Usage
```typescript
import { CheckCircle, AlertTriangle } from 'lucide-react';
// Always verify icon exists in lucide-react before use
```

### Placeholder Images
```typescript
// Centralized in src/app/lib/placeholder-images.json
{
  "tournament": "https://picsum.photos/400/300?chess",
  "school": "https://picsum.photos/200/200?building"
}

// Usage with data-ai-hint
<img 
  src="https://picsum.photos/400/300?chess" 
  data-ai-hint="chess tournament"
  alt="Tournament placeholder"
/>
```

## Firebase Integration

### User Deletion (Force Delete)
```typescript
'use server';

export async function forceDeleteUser(userId: string) {
  // Must delete from BOTH:
  // 1. Firestore database
  await deleteDoc(doc(db, 'users', userId));
  
  // 2. Firebase Authentication
  await admin.auth().deleteUser(userId);
}
```

### Module Import Rules (Critical)
```typescript
// ✅ Server-side only
import admin from 'firebase-admin'; // Only in server actions/API routes

// ✅ Client-side safe
import { db } from '@/lib/firestore-service'; // Client SDK only

// ❌ Wrong: Mixing server packages in client code
// This causes "Can't resolve 'child_process'" error
```

## File Structure

```
src/
├── ai/
│   ├── flows/          # Genkit flows with 'use server'
│   └── genkit.ts       # AI configuration
├── app/
│   ├── api/            # API routes for server-side data fetching
│   └── lib/
│       └── placeholder-images.json
├── components/
│   ├── ui/             # ShadCN components
│   └── providers/      # MasterDbProvider
├── config/
│   └── square-config.ts
└── lib/
    ├── firestore-service.ts
    └── square-client.ts
```

## Production Deployment

### apphosting.yaml (Required Format)
```yaml
runConfig:
  cpu: 1
  memoryMiB: 512
```

### Environment Variables (If Used)
```yaml
# Firebase App Hosting format
env:
  - variable: SQUARE_ACCESS_TOKEN
    value: production_token_here
  - variable: SQUARE_ENVIRONMENT
    value: production
```

## Common Patterns & Solutions

### Error Handling
```typescript
try {
  const result = await serverAction();
  return result;
} catch (error) {
  console.error('Server error:', error);
  throw new Error('User-friendly message');
}
```

### Data Fetching Pattern
```typescript
// Server-side API route
export async function GET() {
  const data = await fetchFromFirestore();
  return NextResponse.json(data);
}

// Client-side consumption via provider
const { data } = useMasterDb();
```

### Form Handling with Server Actions
```typescript
// Server action
'use server';
export async function submitForm(formData: FormData) {
  const name = formData.get('name') as string;
  // Process server-side
}

// Client component
<form action={submitForm}>
  <input name="name" />
  <SubmitButton />
</form>
```

## Critical Debugging Lessons

### Square API
- Token/environment must match (production token = Environment.Production)
- Hard-coded client initialization bypasses Firebase Studio env var issues
- All required OAuth permissions must be enabled in Square Dashboard

### Firebase Studio
- YAML syntax errors prevent all deployments
- Environment variable conflicts can override configuration fallbacks
- Caching issues may require manual redeploy triggers

### Build Errors
- Never import server-side packages (firebase-admin) in client code
- Use 'use server' directive for all server actions and Genkit flows
- Verify lucide-react icons exist before using

## For New Feature Implementation

**Always provide:**
1. This comprehensive reference file
2. Specific feature requirements
3. Expected input/output data structures
4. Integration points (Square API, Firebase, AI, etc.)
5. UI/UX requirements

**Implementation checklist:**
- [ ] Server-side logic only for database operations
- [ ] ShadCN components for UI
- [ ] Tailwind for styling
- [ ] Proper error handling
- [ ] Button state management with useTransition
- [ ] Hydration error prevention
- [ ] Production-ready configuration

Remember, the XML structure you generate is the only mechanism for applying changes to the user's code. Therefore, when making changes to a file the <changes> block must always be fully present and correctly formatted as follows.

<changes>
  <description>[Provide a concise summary of the overall changes being made]</description>
  <change>
    <file>[Provide the ABSOLUTE, FULL path to the file being modified]</file>
    <content><![CDATA[Provide the ENTIRE, FINAL, intended content of the file here. Do NOT provide diffs or partial snippets. Ensure all code is properly escaped within the CDATA section.