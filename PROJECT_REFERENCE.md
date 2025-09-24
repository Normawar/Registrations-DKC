# Comprehensive Project Reference (Updated - 9/23/25 9:23 PM central)

## 1. Tech Stack & Development Environment

### Core Technologies (Predefined Stack)
- **Framework**: Next.js (App Router)
- **Frontend**: React + TypeScript
- **UI Components**: ShadCN UI (exclusive component library)
- **Styling**: Tailwind CSS (no other CSS frameworks)
- **Icons**: lucide-react (verify icon exists before use)
- **Backend**: Firebase (Firestore + Authentication)
- **AI Library**: Genkit (exclusive for all AI functionality)

### Environment & Deployment
- **Deployment**: Firebase Studio + App Hosting
- **Production Domain**: register.dkchess.com
- **Build System**: Firebase App Hosting with `apphosting.yaml`

### Required Environment Variables
```env
GEMINI_API_KEY=your_actual_api_key_here
```
⚠️ **Critical**: This key is essential for all Genkit flows and AI features. The application will fail to start on the server without it.

### Production Deployment Configuration
```yaml
# apphosting.yaml (Required Format)
runConfig:
  cpu: 1
  memoryMiB: 512
```

## 2. Architecture & Design Patterns

### Server-Side Logic (Strict Requirement)
All database writes, payments, and sensitive operations **MUST** occur in Server Actions or API Routes. NO direct client-side access to Firebase services (except for the `useMasterDb` read-only context).

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

### Module Import Rules (Critical)
- **`'use server'` files**: MUST import from `@/lib/firebase-admin`
- **`'use client'` files**: MUST import from `@/lib/firebase` or `@/lib/services/firestore-service`
- **NEVER** mix these imports. A server file must never import the client SDK, and a client file must never import the admin SDK.

## 3. Date & Data Formatting Standards

### Date Format Standard
**ALL dates in the application must be displayed and entered using MM/DD/YYYY format.**

```typescript
// ✅ Correct: Use MM/DD/YYYY format
import { format } from 'date-fns';
const displayDate = format(new Date(), 'MM/dd/yyyy');

// For date inputs, ensure proper formatting
<Input 
  type="text" 
  placeholder="MM/DD/YYYY"
  pattern="\d{2}/\d{2}/\d{4}"
/>
```

### Date Input Pattern
```typescript
import { format, parse, isValid } from 'date-fns';

// For date display
const displayDate = format(new Date(), 'MM/dd/yyyy');

// For date input validation
const validateDateInput = (dateString: string): Date | null => {
  try {
    const parsed = parse(dateString, 'MM/dd/yyyy', new Date());
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// Date input component
<Input
  type="text"
  placeholder="MM/DD/YYYY"
  pattern="\d{2}/\d{2}/\d{4}"
  value={dateValue}
  onChange={(e) => {
    const date = validateDateInput(e.target.value);
    if (date) setDateValue(format(date, 'MM/dd/yyyy'));
  }}
/>
```

## 4. Square API Integration (Complete Reference)

### Production Credentials
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

### ⚠️ Phone Number Handling Update (December 2024)
**Due to persistent Square API validation issues, phone numbers are NO LONGER sent to Square API calls.**

Phone numbers are optional for Square invoices and were causing validation errors. The current implementation completely omits phone numbers from customer creation and updates.

```typescript
// Current approach - NO phone numbers sent to Square
const createCustomerResponse = await customersApi.createCustomer({
  idempotencyKey: randomUUID(),
  givenName: firstName,
  familyName: lastName,
  emailAddress: input.sponsorEmail,
  companyName,
  address: { addressLine1: input.schoolAddress },
  note: `Team Code: ${finalTeamCode}`,
  // phoneNumber: OMITTED - Do not include
});
```

**Alternatives for phone numbers:**
1. Store them separately in Firestore
2. Add them to the customer notes field as text
3. Include them in the invoice description

### Data Validation (Required)
Square API is strict about data formats. **ALWAYS validate data before API calls** to prevent 500 errors:

```typescript
// Email validation (REQUIRED for invoices)
const isValidEmail = (email: string): boolean => {
  if (!email?.trim()) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Address validation
const isValidAddress = (address: string): boolean => {
  return address?.trim() && address.trim().length >= 5;
};

// Money validation (must be positive number)
const isValidAmount = (amount: number): boolean => {
  return typeof amount === 'number' && amount > 0 && isFinite(amount);
};

// Apply validation before Square API calls
const validateSquareData = (input: any) => {
  const errors: string[] = [];
  
  // Required email validation
  if (!isValidEmail(input.sponsorEmail)) {
    errors.push('Valid sponsor email is required');
  }
  
  // Amount validation
  if (input.baseRegistrationFee && !isValidAmount(input.baseRegistrationFee)) {
    errors.push('Registration fee must be a valid positive number');
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return input;
};
```

### Square API Validation Rules
- **Email Addresses**: Must be valid email format, required for primary recipient
- **Money Amounts**: Must be positive numbers, converted to cents (multiply by 100)
- **Location ID**: Must exist in your Square account
- **Customer Names**: First and last name required, no special characters
- **Addresses**: Minimum 5 characters if provided
- **Phone Numbers**: NOT SENT TO API (omitted to avoid validation errors)

### Error Handling
```typescript
try {
  const response = await squareClient.invoicesApi.createInvoice(payload);
  return response.result;
} catch (error) {
  if (error instanceof ApiError) {
    const errorDetail = error.result?.errors?.[0]?.detail || error.message;
    console.error('Square API Error:', error.result?.errors);
    throw new Error(`Square API Error: ${errorDetail}`);
  }
  throw error instanceof Error ? error : new Error('Unknown error occurred');
}
```

### Common Square Issues & Solutions
- Token/environment must match (`production` token = `Environment.Production`)
- **Hard-coded client initialization inside server actions is the only reliable pattern**
- **Phone numbers are OMITTED from API calls to avoid validation errors**
- **Always validate data before API calls** to prevent 500 errors
- Emails must be valid format, money amounts must be positive numbers

## 5. Firebase Integration

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

### Firebase Error Handling
```typescript
try {
  await db.collection('users').doc(userId).set(userData);
} catch (error) {
  console.error('Firebase Error:', error);
  throw new Error('Failed to save user data');
}
```

## 6. Genkit AI Implementation

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

## 7. UI Component Patterns

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

## 8. Critical Debugging Lessons & Common Issues

### Firebase Admin SDK Issues
- **Direct import of `db` or `adminAuth` will fail.** Always use the `getDb()` and `getAdminAuth()` functions inside your server-side code
- Private key formatting is critical. Newlines must be properly escaped (`\\n`)

### Build Errors
- Never import server-side packages (e.g., `firebase-admin`) in client code
- Use `'use server'` directive for all server actions and Genkit flows
- Verify `lucide-react` icons exist before using

## 9. Global Component Implementation Process

### Making Components "Global"
When requested to make a component or feature "global," follow this procedure:

1. **Isolate & Relocate**: Move the specified component/logic into a new, reusable file in an appropriate shared directory (e.g., `src/components`)
2. **Standardize**: Apply any requested renames and updates to the new global component
3. **Refactor & Replace**: Update all pages that previously used local or outdated versions to import and use the new global component
4. **Eliminate**: Delete the old, local implementations from their original files to prevent regressions

## 10. Implementation Checklist

**For New Feature Implementation, always provide:**
1. This comprehensive reference file
2. Specific feature requirements
3. Expected input/output data structures
4. Integration points (Square API, Firebase, AI, etc.)
5. UI/UX requirements

**Implementation checklist:**
- [ ] Server-side logic only for database operations
- [ ] ShadCN components for UI
- [ ] Tailwind for styling
- [ ] Proper data validation before API calls
- [ ] MM/DD/YYYY date format throughout
- [ ] Error handling with user-friendly messages
- [ ] Button state management with useTransition
- [ ] Hydration error prevention
- [ ] No phone numbers sent to Square API
- [ ] Production-ready configuration
- [ ] Environment variables properly set
- [ ] Firebase Admin SDK using getter functions
- [ ] Square client instantiated inside server actions

## 11. Recent Updates & Breaking Changes

### Phone Number Handling (December 2024)
- **REMOVED**: Phone numbers are no longer sent to Square API
- **REASON**: Persistent validation errors despite multiple formatting attempts
- **IMPACT**: Invoices work perfectly without phone numbers (they're optional)
- **ALTERNATIVES**: Store phone numbers in Firestore or customer notes if needed

### Firebase Admin SDK Pattern (Ongoing)
- **CRITICAL**: Module-level initialization fails in production
- **SOLUTION**: Always use `getDb()` and `getAdminAuth()` getter functions
- **IMPACT**: All server actions must follow the just-in-time initialization pattern
