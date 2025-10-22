# Complete Invoicing System Documentation

## System Overview

The DKChess Registration System uses a **Hybrid Invoicing Architecture** that intelligently routes invoice creation based on district and player composition.

## Architecture Components

### 1. Router Layer
**File**: `src/ai/flows/create-sponsor-invoice-flow.ts`

This is the main entry point that implements the decision tree:

```
Registration Request
        ↓
Is PSJA District?
    ├─ NO → create-invoice-flow.ts (Standard Single Invoice)
    └─ YES → Mixed GT/Independent Players?
            ├─ NO → create-invoice-flow.ts (Standard Single Invoice)
            └─ YES → create-psja-split-invoice-flow.ts (Split Invoices)
```

### 2. Standard Invoice Worker
**File**: `src/ai/flows/create-invoice-flow.ts`

Handles all standard cases:
- Single invoice for all players
- Includes registration fees + late fees + USCF fees
- Used by ALL non-PSJA districts
- Used by PSJA when all players are same type

### 3. Specialized PSJA Worker
**File**: `src/ai/flows/create-psja-split-invoice-flow.ts`

Handles PSJA mixed registrations:
- **GT Invoice**: GT players only, registration fees only
- **Independent Invoice**: Independent players + ALL late fees (GT + Independent)
- Separate recipients for each invoice type

## Decision Tree Logic

```typescript
async function routeInvoiceCreation(input: CreateInvoiceInput) {
  // Step 1: Check if PSJA district
  const isPSJA = input.district === 'PHARR-SAN JUAN-ALAMO ISD';
  
  if (!isPSJA) {
    // Standard flow for all other districts
    return await createInvoice(input);
  }
  
  // Step 2: Check if mixed player types
  const hasGT = input.players.some(p => p.isGtPlayer);
  const hasIndependent = input.players.some(p => !p.isGtPlayer);
  const isMixed = hasGT && hasIndependent;
  
  if (!isMixed) {
    // PSJA with uniform player types → Standard flow
    return await createInvoice(input);
  }
  
  // Step 3: PSJA with mixed types → Split invoice flow
  return await createPsjaSplitInvoice(input);
}
```

## Portal Integration Points

### Individual Portal
**Current State**: Uses `create-individual-invoice-flow.ts`
- Parents registering their own children
- Immediate payment required
- Family discounts may apply

### Sponsor Portal
**Current State**: Uses `create-sponsor-invoice-flow.ts` (Router)
- School sponsors registering students
- Routes to appropriate invoice creation method
- May require PO numbers (district-dependent)

### District Coordinator Portal
**Planned**: Will use Router with enhanced logic
- Bulk registrations across multiple schools
- District-wide payment terms
- Special rate handling

### Organizer Portal
**Planned**: Will use Router with administrative overrides
- Comp rates
- Special handling
- Manual adjustments

## Enhanced Registration Dialog System

### Unified Dialog Component
**Proposed**: `src/components/enhanced-registration-dialog.tsx`

A single, adaptive registration dialog that:
1. Accepts `portalType` prop to determine behavior
2. Shows/hides fields based on portal and district
3. Calls appropriate invoice creation flow
4. Handles success/error states consistently

```typescript
interface EnhancedRegistrationDialogProps {
  portalType: 'individual' | 'sponsor' | 'district-coordinator' | 'organizer';
  userProfile: UserProfile;
  selectedEvent: Event;
  selectedPlayers: Player[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### Portal-Specific Field Logic

```typescript
// Example field visibility rules
const showPOField = 
  portalType === 'sponsor' && 
  userProfile.district === 'Houston ISD';

const showDistrictCode = 
  portalType === 'district-coordinator';

const showCompRate = 
  portalType === 'organizer';
```

## PSJA Split Invoice Details

### GT Invoice Components
- **Recipients**: GT Coordinator email
- **Line Items**: 
  - Registration fees for GT players only
  - No USCF fees (district covers)
  - No late fees
- **Payment Terms**: Net 30 days (PO required)

### Independent Invoice Components
- **Recipients**: School sponsor email
- **Line Items**:
  - Registration fees for Independent players
  - USCF fees for Independent players
  - **ALL late fees** (both GT and Independent players)
- **Payment Terms**: Net 30 days (PO required)

### Why Split Invoices for PSJA?

PSJA's GT program has different billing requirements:
1. GT Coordinator handles GT registrations centrally
2. Individual schools handle their Independent players
3. Late fees are consolidated on Independent invoice for accounting
4. USCF memberships handled differently by program type

## Data Flow Example

### Standard Registration (Non-PSJA)
```
Sponsor Portal Submit
    ↓
create-sponsor-invoice-flow (Router)
    ↓
Detects: District = "Houston ISD"
    ↓
create-invoice-flow (Standard Worker)
    ↓
Creates single invoice with all fees
    ↓
Invoice sent to sponsor email
```

### PSJA Mixed Registration
```
Sponsor Portal Submit
    ↓
create-sponsor-invoice-flow (Router)
    ↓
Detects: District = "PHARR-SAN JUAN-ALAMO ISD"
Detects: Has GT + Independent players
    ↓
create-psja-split-invoice-flow (Specialized Worker)
    ↓
Split 1: GT Invoice (GT players, registration only)
    ↓ (sent to GT Coordinator)
Split 2: Independent Invoice (Independent players + all late fees)
    ↓ (sent to School Sponsor)
```

## Invoice Router Implementation

### Unified Router Approach
**File**: `src/lib/invoice-router.ts`

```typescript
export interface UnifiedInvoiceRequest extends CreateInvoiceInput {
  portalType: 'individual' | 'sponsor' | 'district-coordinator' | 'organizer';
  userProfile: UserProfile;
}

export async function createUnifiedInvoice(request: UnifiedInvoiceRequest) {
  // PSJA Special Case Detection
  if (isPsjaSpecialCase(request)) {
    return await createPsjaSplitInvoice({
      ...request,
      district: 'PHARR-SAN JUAN-ALAMO ISD'
    });
  }
  
  // Portal-specific enhancements
  const enhanced = applyPortalEnhancements(request);
  
  // Route to appropriate flow
  switch (request.portalType) {
    case 'individual':
      return await createIndividualInvoice(enhanced);
    
    case 'sponsor':
    case 'district-coordinator':
    case 'organizer':
      return await createInvoice(enhanced);
  }
}

function isPsjaSpecialCase(request: UnifiedInvoiceRequest): boolean {
  if (request.district !== 'PHARR-SAN JUAN-ALAMO ISD') return false;
  
  const hasGT = request.players.some(p => p.isGtPlayer);
  const hasIndependent = request.players.some(p => !p.isGtPlayer);
  
  return hasGT && hasIndependent;
}
```

## Testing Scenarios

### Test Case 1: Houston ISD Sponsor
- **District**: Houston ISD
- **Players**: 5 students (all same type)
- **Expected**: Single invoice via `create-invoice-flow`
- **Fields**: PO number required

### Test Case 2: PSJA All GT
- **District**: PHARR-SAN JUAN-ALAMO ISD
- **Players**: 3 GT students only
- **Expected**: Single invoice via `create-invoice-flow`
- **Recipient**: GT Coordinator

### Test Case 3: PSJA Mixed
- **District**: PHARR-SAN JUAN-ALAMO ISD
- **Players**: 2 GT students + 3 Independent students
- **Expected**: Two invoices via `create-psja-split-invoice-flow`
- **Invoice 1**: GT students (to GT Coordinator)
- **Invoice 2**: Independent students + all late fees (to Sponsor)

### Test Case 4: Individual Parent
- **Portal**: Individual
- **Players**: Own children (1-3 students)
- **Expected**: Single invoice via `create-individual-invoice-flow`
- **Payment**: Immediate

## Benefits of Current Architecture

1. **Isolated Complexity**: PSJA logic contained in one specialized file
2. **Maintainable**: Standard cases use simple, proven flow
3. **Scalable**: Easy to add new districts with special requirements
4. **Testable**: Each flow can be tested independently
5. **Low Risk**: Changes to standard flow don't affect PSJA logic

## Migration Path for Lost Features

When comparing with commit `f6dbae6`, focus on these areas:

### Invoicing Improvements to Check
1. **Validation enhancements** in any invoice flow
2. **Error handling** improvements
3. **Email formatting** for invoice recipients
4. **Fee calculation logic** refinements
5. **UI feedback** in registration dialogs

### Player Details Improvements to Check
1. **Player profile display** enhancements
2. **Edit functionality** improvements
3. **Data validation** on player forms
4. **USCF integration** enhancements
5. **Student type handling** (GT vs Independent)

## Current Status (10/02/25)

### ✅ Confirmed Working
- Firebase Admin SDK operational
- Invoice routing logic functional
- PSJA split invoice system intact

### 🔍 Needs Comparison
- Enhanced validation from f6dbae6
- UI improvements in registration flows
- Player details page enhancements
- Any fee calculation updates

### 📋 Next Steps
1. Access GitHub compare URL to view differences
2. Identify non-Firebase config changes
3. Port over UI/logic improvements
4. Test invoicing flows with improvements
5. Commit restored features