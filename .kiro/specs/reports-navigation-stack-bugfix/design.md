# Reports Navigation Stack Bugfix Design

## Overview

The bug manifests when navigating from the dashboard (inside the `(tabs)` group) to the reports screen (at root level). This cross-group navigation breaks Expo Router's internal stack management, causing:
- Back button to malfunction or navigate unexpectedly
- Navigation context to become corrupted
- Subsequent navigation attempts to fail or behave inconsistently

The fix strategy is to restructure the routing architecture by moving the reports screen into the tab group as a proper Stack-based screen, ensuring consistent stack management and predictable back navigation behavior.

## Glossary

- **Bug_Condition (C)**: Navigation from tab-group dashboard to root-level reports screen breaks the stack
- **Property (P)**: Navigation to reports works correctly with a functioning back button that returns to dashboard
- **Preservation**: Navigation to other screens (inventory, purchase-return, sales-return) from the FAB menu and dashboard continues to work correctly
- **Stack Navigation**: Expo Router's internal stack that manages screen ordering and back navigation
- **Group Layout**: Expo Router's route grouping feature (parentheses syntax) that organizes screens without affecting URL
- **Tab Navigator**: The tab bar at the bottom managed by `(tabs)/_layout.jsx`
- **Root Navigator**: The top-level Stack in `_layout.jsx` that manages authentication and major section navigation
- **Expo Router v54**: The specific version required for this mobile app per workspace rules

## Bug Details

### Bug Condition

The bug manifests when a user initiates navigation from the dashboard (`app/(tabs)/index.jsx`) to the reports screen (`app/reports.jsx`) using either:
1. "View All" button in Recent Sales section
2. "View All" button in Recent Procurements section  
3. "Reports" option in the FAB menu

The bug occurs because reports is defined as a root-level screen in the root Stack navigator, while the dashboard is nested inside the `(tabs)` group. This creates a discontinuity in the navigation stack that prevents proper back navigation and can corrupt the navigation state.

**Formal Specification:**
```
FUNCTION isBugCondition(navigationAction)
  INPUT: navigationAction is a navigation event
  OUTPUT: boolean
  
  RETURN navigationAction.from IN ['dashboard_inside_tabs']
         AND navigationAction.to = 'reports_at_root_level'
         AND NOT properBackNavigation(navigationAction)
         AND stackManagementIsCorrupted(navigationAction)
END FUNCTION
```

### Examples

**Example 1: Navigation via View All Button (Recent Sales)**
- User on dashboard (tab group)
- Presses "View All" → `router.push("/reports")`
- Reports screen displays but back button doesn't return to dashboard
- Pressing back might exit the app or navigate to an unexpected screen

**Example 2: Navigation via FAB Menu**
- User on dashboard with FAB open
- Presses "Reports" button → `router.push("/reports")`
- Same issue: back navigation is broken or inconsistent

**Example 3: Back Navigation Failure**
- Even after reaching reports, attempting to go back to dashboard fails
- Navigation state shows dashboard isn't in the stack hierarchy
- Back button might navigate to login or another unrelated screen

**Example 4: Preserved Behavior That Works**
- Navigation from dashboard to inventory (root level) via notification bell works correctly
- Back button returns to dashboard as expected
- This works because inventory is at root level but navigation context is properly maintained

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Dashboard displays all metrics, cards, and UI elements exactly as before
- FAB menu continues to show all options (Reports, Stock, Procure, New Sale)
- Clicking any FAB option navigates to the respective screen
- Report screen displays all data, filters, and export functionality
- Tab bar remains visible and functional while on dashboard
- Bottom navigation between tabs (Home, Sell, Purchase, Accounts) works correctly
- Navigation to inventory, purchase-return, and sales-return from FAB and dashboard header continues working
- All API calls and data fetching behavior remains unchanged
- Report filtering, sorting, and pagination work identically

**Scope:**
All navigation paths that do NOT involve going from dashboard to reports should be completely unaffected by this fix. This includes:
- Inter-tab navigation (switching between home/sell/purchase/accounts)
- Navigation from dashboard to inventory via notification bell
- Navigation to purchase-return and sales-return via FAB
- Navigation from reports back to dashboard (once fixed)
- All internal report tab navigation (sales, purchases, expenses, customers, suppliers)
- Report filtering and data operations

## Hypothesized Root Cause

Based on the navigation architecture analysis, the most likely issues are:

1. **Stack Discontinuity**: 
   - Dashboard is nested inside `(tabs)` group which has its own Stack via Tabs component
   - Reports is a direct child of root Stack
   - This creates two separate stack hierarchies that can't be properly linked
   - Back button tries to navigate within the Tabs stack instead of crossing to root

2. **Navigation Context Mismatch**:
   - Tabs navigator manages its own navigation context
   - Root Stack has a different navigation context
   - Jumping between these contexts without proper linking breaks the internal state

3. **Improper Stack Linking**:
   - Current setup uses two separate navigators without proper linking configuration
   - The `linking` prop in Stack isn't configured to handle tab-to-root navigation

4. **Screen Options Configuration**:
   - Reports screen options in root Stack don't account for being called from within a nested navigator
   - Back button behavior isn't explicitly configured for cross-navigator transitions

## Correctness Properties

Property 1: Bug Condition - Reports Navigation with Correct Back Button

_For any_ navigation action where a user initiates navigation from the dashboard to the reports screen (via "View All", FAB, or direct link), the fixed navigation architecture SHALL:
1. Display the reports screen correctly with all data and functionality
2. Maintain a proper navigation stack that includes the dashboard as the previous screen
3. Provide a functioning back button that returns to the dashboard

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Non-Reports Navigation Behavior

_For any_ navigation action that does NOT involve navigating to reports (inter-tab navigation, navigation to inventory/purchase-return/sales-return, internal report navigation), the fixed navigation architecture SHALL produce exactly the same behavior as the original code, preserving all navigation patterns, screen display, and API interactions.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Solution: Move Reports into Tab Group with Proper Stack Integration

The recommended approach is **Option 1: Move reports screen inside the tab group** because:
- Maintains simplicity and consistency in navigation hierarchy
- Avoids modal complexity and performance overhead
- Provides natural back navigation within a unified stack
- Minimal changes to existing code structure

### Changes Required

**File**: `app/(tabs)/_layout.jsx`

**Changes**:
1. Add a new `<Tabs.Screen>` entry that wraps the reports screen in a Stack navigator
2. This Stack will manage reports and any related detail screens as needed
3. Configure proper screen options for reports

```javascript
// Inside the <Tabs> component, add:
<Tabs.Screen
  name="reports"
  options={{
    title: "Reports",
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="pie-chart" size={size} color={color} />
    ),
    // Hide from tab bar visually (or keep visible based on UX preference)
    tabBarStyle: { display: 'none' }, // Optional: hide when on reports
  }}
  listeners={({ navigation }) => ({
    tabPress: (e) => {
      e.preventDefault(); // Prevent switching to reports tab normally
      navigation.navigate('ReportsStack');
    },
  })}
/>
```

**File**: `app/(tabs)/reports/_layout.jsx` (NEW FILE)

**Create a new Stack layout** inside a reports subdirectory:
```javascript
import React from 'react';
import { Stack } from 'expo-router';

export default function ReportsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* Add detail screens as needed */}
    </Stack>
  );
}
```

**File**: `app/(tabs)/reports/index.jsx` (MOVE)

**Action**: Move the current `app/reports.jsx` to `app/(tabs)/reports/index.jsx`
- No code changes needed; same component logic applies
- This relocates the screen within the tab hierarchy

**File**: `app/_layout.jsx`

**Changes**:
1. Remove the `<Stack.Screen name="reports" />` entry since it's now in tabs
2. Keep entries for other root-level screens (inventory, purchase-return, sales-return)
3. Verify root Stack configuration is correct

**Rationale**: By placing reports as a tab group screen with its own Stack layout, it:
- Shares the same navigation context as the dashboard
- Maintains proper stack hierarchy for back navigation
- Allows the back button to naturally navigate to the previous screen in the tab group
- Doesn't break existing tab navigation or FAB functionality

### Navigation Update

**File**: Update all navigation calls pointing to reports:
- `router.push("/reports")` → `router.push("/(tabs)/reports")`
- Or keep as `router.push("/reports")` if Expo Router supports both paths

Current locations that need updates:
1. `app/(tabs)/index.jsx` - "View All" buttons in Recent Sales and Recent Procurements
2. `app/(tabs)/index.jsx` - FAB menu "Reports" button
3. Any other screens that link to reports

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior through exploratory, fix, and preservation checking.

### Exploratory Bug Condition Checking

**Goal**: Demonstrate the bug on UNFIXED code by showing that back navigation from reports fails or behaves incorrectly.

**Test Plan**: Create tests that simulate navigation from dashboard to reports and verify the back button behavior. Run these tests on the UNFIXED code to confirm the bug exists before implementing the fix.

**Test Cases**:
1. **View All Button Navigation** (will fail on unfixed code)
   - Simulate user pressing "View All" in Recent Sales section
   - Verify reports screen displays
   - Attempt back navigation
   - Assert: Back button should return to dashboard (will fail on unfixed code)

2. **FAB Menu Navigation** (will fail on unfixed code)
   - Simulate user opening FAB and pressing Reports
   - Verify reports screen displays with all data
   - Attempt back navigation
   - Assert: Back button should return to dashboard (will fail on unfixed code)

3. **Direct Link Navigation** (will fail on unfixed code)
   - Simulate direct navigation via `router.push("/reports")`
   - Verify navigation succeeds
   - Attempt back navigation
   - Assert: Back should return to previous screen in correct context (will fail on unfixed code)

4. **Back Navigation Consistency** (will fail on unfixed code)
   - Navigate from dashboard → reports
   - Press back → should return to dashboard
   - Navigate to reports again → should work
   - Assert: Multiple back/forward cycles maintain consistency (will fail on unfixed code)

**Expected Counterexamples on Unfixed Code**:
- Back button navigates to login or wrong screen instead of dashboard
- Back button doesn't respond or app closes unexpectedly
- Navigation state shows dashboard isn't in the stack hierarchy
- Repeated navigation attempts fail or show error state

### Fix Checking

**Goal**: Verify that after the fix, navigation from dashboard to reports works correctly with a functioning back button.

**Pseudocode:**
```
FOR ALL navigationAction WHERE isBugCondition(navigationAction) DO
  // Execute navigation
  result := navigateToReports(navigationAction)
  
  // Verify reports displays
  ASSERT reportsScreenIsVisible(result)
  ASSERT allReportDataLoads(result)
  
  // Verify back navigation works
  backResult := pressBackButton(result)
  ASSERT backResult.currentScreen = 'dashboard'
  ASSERT backResult.navigationStackIsValid(result)
END FOR
```

**Test Cases**:
1. **Fixed View All Navigation**: Verify "View All" buttons navigate to reports and back works
2. **Fixed FAB Navigation**: Verify FAB menu Reports button navigates correctly and back works
3. **Fixed Direct Navigation**: Verify `router.push` to reports and back work correctly
4. **Fixed Back Button**: Verify back button always returns to dashboard when on reports

### Preservation Checking

**Goal**: Verify that all non-reports navigation behavior remains unchanged after the fix.

**Pseudocode:**
```
FOR ALL navigationAction WHERE NOT isBugCondition(navigationAction) DO
  // Execute navigation on both original and fixed code
  originalResult := navigationOnUnfixedCode(navigationAction)
  fixedResult := navigationOnFixedCode(navigationAction)
  
  // Verify results match
  ASSERT originalResult.screenDisplayed = fixedResult.screenDisplayed
  ASSERT originalResult.navigationPath = fixedResult.navigationPath
  ASSERT originalResult.backNavigationBehavior = fixedResult.backNavigationBehavior
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across various navigation paths
- It catches edge cases where navigation might break unexpectedly
- It provides strong guarantees that non-reports navigation is unchanged
- It validates all combinations of FAB menu options and inter-tab navigation

**Test Cases**:
1. **Inter-Tab Navigation Preservation**: 
   - Verify switching between Home, Sell, Purchase, Accounts tabs works exactly as before
   - Verify tab bar state and styling remains unchanged
   - Verify data doesn't reload unexpectedly when switching tabs

2. **Inventory Navigation Preservation**:
   - Verify notification bell navigates to inventory correctly
   - Verify back button returns to dashboard
   - Verify dashboard metrics and UI remain unchanged

3. **FAB Menu Navigation Preservation** (non-reports options):
   - Verify Stock, Procure, and New Sale buttons work correctly
   - Verify back navigation from each screen works
   - Verify FAB menu opens/closes consistently

4. **Purchase-Return and Sales-Return Navigation Preservation**:
   - Verify these screens remain accessible from root level
   - Verify back navigation from these screens works correctly
   - Verify they don't interfere with tab group navigation

5. **Dashboard Display Preservation**:
   - Verify all dashboard metrics display correctly
   - Verify all cards, buttons, and UI elements render identically
   - Verify refresh functionality works
   - Verify low stock alerts display and behave the same

6. **Report Internal Navigation Preservation**:
   - Verify tab switching within reports (Sales, Purchases, Expenses, Customers, Suppliers) works
   - Verify data filtering and pagination work identically
   - Verify export functionality is unchanged
   - Verify payment modals work correctly

### Unit Tests

- Test individual navigation functions with mock navigation context
- Test screen component rendering with various props
- Test FAB menu state management (open/close, navigation calls)
- Test back button handler configuration
- Test screen options and navigation parameters

### Property-Based Tests

- Generate random navigation paths and verify consistent behavior
- Generate random user interactions (tab presses, button taps, back presses) and verify state consistency
- Generate various screen state combinations and verify navigation works correctly
- Test that all non-reports navigation continues to work across many random scenarios

### Integration Tests

- Test full navigation flow: login → dashboard → reports → back to dashboard → navigate to other screens
- Test switching between tabs while reports navigation is possible
- Test FAB menu interactions in various states
- Test back button behavior through complete user journey
- Test that switching to reports and back doesn't break subsequent navigation
- Test state persistence when navigating away from and back to dashboard

## Implementation Checklist

- [ ] Create `app/(tabs)/reports/` directory structure
- [ ] Create `app/(tabs)/reports/_layout.jsx` with Stack configuration
- [ ] Move `app/reports.jsx` → `app/(tabs)/reports/index.jsx`
- [ ] Update `app/(tabs)/_layout.jsx` to add reports screen
- [ ] Update `app/_layout.jsx` to remove reports from root Stack
- [ ] Update all `router.push("/reports")` calls to `router.push("/(tabs)/reports")`
- [ ] Test back navigation from reports to dashboard
- [ ] Test all FAB menu navigation options
- [ ] Test inter-tab navigation functionality
- [ ] Verify all preservation requirements
- [ ] Run integration tests covering complete user flows
