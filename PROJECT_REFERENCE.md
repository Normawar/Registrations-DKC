# Comprehensive Project Reference (Updated - 10/02/25)

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
GOOGLE_APPLICATION_CREDENTIALS=/workspace/.firebase/dkchess-registrations-8fed4b8abf46.json
```
⚠️ **Critical**: 
- GEMINI_API_KEY is essential for all Genkit flows and AI features
- GOOGLE_APPLICATION_CREDENTIALS must point to the service account JSON file for Firebase Admin SDK

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

### ✅ Reliable Firebase Admin SDK Pattern (CRITICAL - UPDATED 10/02/25)
The Firebase Admin SDK initialization has been completely refactored for reliability. The app now uses **direct initialization with service account credentials** instead of Application Default Credentials (ADC).

```typescript
// ✅ Current Pattern: Direct initialization in firebase-admin.ts
import * as admin from 'firebase-admin';

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'dkchess-registrations',
  });
}

export const db = admin.firestore();
export const adminAuth = admin.auth();

// ✅ Usage in server actions - direct import is now safe
'use server';
import { db, adminAuth } from '@/lib/firebase-admin';

export async function myDbAction() {
  // Now you can safely use db and adminAuth directly
  await db.collection('users').get();
}
```

### Service Account Configuration (REQUIRED)
The service account JSON must be provided as an environment variable:

```env
# .env.local
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"dkchess-registrations",...}
```

Or for deployment, the JSON file should be mounted at:
```
/workspace/.firebase/dkchess-registrations-8fed4b8abf46.json
```

And referenced via:
```env
GOOGLE_APPLICATION_CREDENTIALS=/workspace/.firebase/dkchess-registrations-8fed4b8abf46.json
```

### User Deletion (Force Delete)
```typescript
'use server';
import { db, adminAuth } from '@/lib/firebase-admin';

export async function forceDeleteUser(userId: string) {
  // Must delete from BOTH:
  // 1. Firestore database
  await db.collection('users').doc(userId).delete();
  
  // 2. Firebase Authentication
  await adminAuth.deleteUser(userId);
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

### Firebase Admin SDK Issues (RESOLVED - 10/02/25)
- **Previous Issue**: Getter functions (`getDb()`, `getAdminAuth()`) were unreliable
- **Solution**: Direct initialization with service account credentials
- **Current Pattern**: Import `db` and `adminAuth` directly from `@/lib/firebase-admin`
- **Critical**: Service account JSON must be properly configured in environment

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
- [ ] Firebase Admin SDK using direct import pattern
- [ ] Square client instantiated inside server actions

## 11. Recent Updates & Breaking Changes

### Firebase Admin SDK Initialization (October 2, 2025) ✅
- **UPDATED**: Module-level initialization now works reliably
- **METHOD**: Direct initialization with service account credentials
- **BREAKING CHANGE**: Old getter function pattern (`getDb()`, `getAdminAuth()`) is deprecated
- **NEW PATTERN**: Direct import of `db` and `adminAuth` from `@/lib/firebase-admin`
- **REQUIREMENT**: Service account JSON must be configured via environment variable

### Phone Number Handling (December 2024)
- **REMOVED**: Phone numbers are no longer sent to Square API
- **REASON**: Persistent validation errors despite multiple formatting attempts
- **IMPACT**: Invoices work perfectly without phone numbers (they're optional)
- **ALTERNATIVES**: Store phone numbers in Firestore or customer notes if needed

## 12. Current Project Status (10/02/25)

### ✅ Working Components
- Firebase Admin SDK fully operational with direct initialization
- Service account authentication configured and tested
- Database reads and writes functioning correctly
- Authentication system operational

### 🔄 Pending Review
- Comparison with previous commit (f6dbae6) to identify lost improvements
- Invoicing feature enhancements from previous version
- Player details page improvements from previous version

### 📋 Next Steps
1. Compare current state with commit f6dbae6
2. Identify and restore invoicing improvements
3. Identify and restore player details enhancements
4. Commit working state as backup point

## 13. Data Type Safety & Error Prevention (Added 10/06/25)

### Critical Lesson: Defensive Data Sanitization

**Problem**: Firestore data can have inconsistent types (strings, numbers, objects, Timestamps) even when TypeScript expects strings. Calling `.split()`, `parseISO()`, or other string methods on non-string values causes runtime crashes.

**Root Cause**: 
- CSV imports may store fields as numbers or mixed types
- Firestore Timestamps need conversion to ISO strings
- Type definitions don't enforce runtime type safety
- Server-side rendering fails when encountering invalid data

### ✅ Required Pattern: Safe Data Transformation

**Always sanitize data from `useMasterDb()` before using it in components:**
```typescript
function MyComponent() {
  const { database: allPlayers = [] } = useMasterDb();
  
  // REQUIRED: Transform data to ensure type safety
  const safePlayers = useMemo(() => {
    return allPlayers.map(player => {
      // Helper for safe date conversion
      const safeDate = (dateValue: any): string => {
        if (!dateValue) return '';
        if (typeof dateValue === 'string' && dateValue.trim() !== '') return dateValue;
        try {
          const d = new Date(dateValue);
          if (isNaN(d.getTime())) return '';
          return d.toISOString();
        } catch {
          return '';
        }
      };

      return {
        ...player,
        // String fields - always convert to string
        district: String(player.district || ''),
        school: String(player.school || ''),
        firstName: String(player.firstName || ''),
        lastName: String(player.lastName || ''),
        uscfId: String(player.uscfId || ''),
        email: player.email ? String(player.email) : '',
        
        // Date fields - convert to ISO string safely
        dob: safeDate(player.dob),
        uscfExpiration: safeDate(player.uscfExpiration),
      };
    });
  }, [allPlayers]);
  
  // Use safePlayers everywhere, NOT allPlayers
  const filtered = safePlayers.filter(p => p.district === selectedDistrict);
}

## 13. Data Type Safety & Error Prevention (Added 10/06/25)

### Critical Lesson: Defensive Data Sanitization

**Problem**: Firestore data can have inconsistent types (strings, numbers, objects, Timestamps) even when TypeScript expects strings. Calling `.split()`, `parseISO()`, or other string methods on non-string values causes runtime crashes.

**Root Cause**: 
- CSV imports may store fields as numbers or mixed types
- Firestore Timestamps need conversion to ISO strings
- Type definitions don't enforce runtime type safety
- Server-side rendering fails when encountering invalid data

### ✅ Required Pattern: Safe Data Transformation

**Always sanitize data from `useMasterDb()` before using it in components:**
```typescript
function MyComponent() {
  const { database: allPlayers = [] } = useMasterDb();
  
  // REQUIRED: Transform data to ensure type safety
  const safePlayers = useMemo(() => {
    return allPlayers.map(player => {
      // Helper for safe date conversion
      const safeDate = (dateValue: any): string => {
        if (!dateValue) return '';
        if (typeof dateValue === 'string' && dateValue.trim() !== '') return dateValue;
        try {
          const d = new Date(dateValue);
          if (isNaN(d.getTime())) return '';
          return d.toISOString();
        } catch {
          return '';
        }
      };

      return {
        ...player,
        // String fields - always convert to string
        district: String(player.district || ''),
        school: String(player.school || ''),
        firstName: String(player.firstName || ''),
        lastName: String(player.lastName || ''),
        uscfId: String(player.uscfId || ''),
        email: player.email ? String(player.email) : '',
        
        // Date fields - convert to ISO string safely
        dob: safeDate(player.dob),
        uscfExpiration: safeDate(player.uscfExpiration),
      };
    });
  }, [allPlayers]);
  
  // Use safePlayers everywhere, NOT allPlayers
  const filtered = safePlayers.filter(p => p.district === selectedDistrict);
}
## 14. GitHub Push Protection & Secret Management (Added 10/22/25)

### Critical Lessons
        1. **Never commit secrets to Git**  
          - Service account JSON files, API keys, and access tokens **must not** be checked into the repository.
          - Even accidentally committing secrets can trigger GitHub Secret Scanning alerts.

        2. **Environment Variables Only**  
          - Use `.env.local` or deployment-specific environment variable configurations.
          - Reference secrets in code via `process.env` only.
          - Example:
            ```typescript
            const firebaseKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
            const geminiKey = process.env.GEMINI_API_KEY;
            const squareToken = process.env.SQUARE_ACCESS_TOKEN;
            ```

        3. **Prevent Accidental Pushes**
          - Use `.gitignore` to exclude all secret files:
            ```
            # Ignore local environment files
            .env
            .env.local
            .env.*.local
            
            # Ignore Firebase service account JSON
            *.json
            ```
          - Consider `pre-commit` hooks to scan for API keys and secrets.

        4. **GitHub Secret Scanning**
          - GitHub automatically scans commits for known secret patterns.
          - If a secret is detected, it is immediately blocked, and the commit will fail.
          - You can unblock a false positive via the Security tab:
            - Go to: `Repository → Security → Secret scanning → Unblock secret`
            - Only do this if you are certain the secret is not sensitive.

        5. **Recommended Workflow**
          1. Store secrets in `.env.local` (never commit)
          2. Reference them in server-side code only
          3. Use `process.env` for all keys
          4. Validate that secrets are **never logged** or printed in console output

        6. **Secret Rotation**
          - If a secret is accidentally exposed:
            1. Revoke the old key immediately.
            2. Generate a new key.
            3. Update `.env.local` and deployment environments.
            4. Confirm no traces exist in Git history using `git filter-repo` or `BFG Repo-Cleaner`.

        7. **CI/CD Considerations**
          - Store all production secrets in GitHub Actions Secrets or your CI/CD secret management system.
          - Never hardcode secrets in scripts or configuration files.

        **Summary:**  
        > Always treat API keys, service account files, and access tokens as highly sensitive. Use environment variables, `.gitignore`, and GitHub Secret Scanning to prevent leaks. Follow proper secret rotation procedures if exposed.