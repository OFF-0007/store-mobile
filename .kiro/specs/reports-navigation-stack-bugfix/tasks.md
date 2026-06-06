# Implementation Plan: Reports Navigation Stack Bugfix

## Overview

This task list implements the bugfix for the reports navigation stack issue using the bug condition methodology. The workflow follows a four-phase approach:
1. **Phase 1**: Exploratory bug condition test (demonstrates bug on unfixed code)
2. **Phase 2**: Preservation tests (validates non-reports navigation remains unchanged)
3. **Phase 3**: Implementation and fix validation (applies fix and validates it works)
4. **Phase 4**: Checkpoint (ensures all tests pass)

## Tasks

---

## Phase 1: Bug Condition Exploration

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Reports Navigation Cross-Stack Issue
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **GOAL**: Surface counterexamples demonstrating that back navigation from reports fails when accessed from the dashboard tab group
  - **DO NOT attempt to fix the test or code when it fails**
  - Scoped PBT approach: Test concrete failing cases - navigation from dashboard (inside tabs) to reports (at root level)
  - **Test Implementation Details** (from Bug Condition in design):
    - Simulate navigation from dashboard (`app/(tabs)/index.jsx`) to reports (`app/reports.jsx`) using:
      1. View All button in Recent Sales section: `router.push("/reports")`
      2. View All button in Recent Procurements section: `router.push("/reports")`
      3. FAB menu Reports button: `router.push("/reports")`
    - Verify reports screen displays with all data
    - Verify back button behavior (should return to dashboard but will fail on unfixed code)
    - Assert that navigation stack is properly maintained (will fail on unfixed code)
  - **Expected counterexamples on unfixed code**:
    - Back button navigates to wrong screen (e.g., login, root) instead of dashboard
    - Back button doesn't respond or app closes unexpectedly
    - Navigation state shows dashboard isn't in stack hierarchy
    - Multiple navigation attempts fail with inconsistent behavior
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - Navigation context mismatch between Tabs navigator and root Stack
    - Stack discontinuity prevents proper back navigation linking
    - Jumping between nested tab group context and root context breaks internal state
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2_

---

## Phase 2: Preservation Requirements

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Reports Navigation Paths Remain Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **GOAL**: Capture and preserve all non-reports navigation behavior from unfixed code
  - **Observation Phase** - Run unfixed code and observe:
    1. Dashboard display: All metrics, cards, UI elements display correctly
    2. Tab navigation: Switching between Home, Sell, Purchase, Accounts tabs works
    3. FAB menu: Stock, Procure, New Sale buttons navigate correctly with proper back behavior
    4. Notification bell: Navigates to inventory with working back button
    5. Inter-tab persistence: Switching tabs and returning preserves state
    6. Report internal navigation: Tab switching within reports (Sales, Purchases, Expenses, Customers, Suppliers) works
    7. Data operations: Filtering, sorting, pagination work identically
  - **Property-Based Test Design**:
    - For all navigation actions where `NOT isBugCondition(navigationAction)`:
      - Navigation completes successfully
      - Screen displays with correct data
      - Back button returns to previous screen in correct navigation context
      - Tab bar remains visible and functional (if applicable)
      - No unexpected state changes occur
  - **Test Cases to Generate**:
    1. Inter-tab navigation: Home → Sell → Purchase → Accounts → Home cycles
    2. Inventory navigation: Dashboard bell → Inventory → Back to dashboard
    3. FAB menu non-reports navigation: Each option (Stock, Procure, New Sale) navigates and back works
    4. Purchase-return and sales-return: Root-level navigation continues working
    5. Internal report navigation: Tab switching within reports (all 5 tabs)
    6. Dashboard state preservation: Navigating away and back to dashboard preserves metrics
    7. Scroll position preservation: Scroll state on screens preserved when navigating back
  - Run property-based tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Property-based testing generates many test cases for stronger guarantees
  - Mark task complete when tests are written, run, and all pass on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

---

## Phase 3: Implementation

- [ ] 3. Fix for Reports Navigation Stack Issue

  - [ ] 3.1 Create reports directory and file structure
    - Create directory: `app/(tabs)/reports/`
    - This moves reports from root level into the tab group hierarchy
    - This ensures reports shares the same navigation context as the dashboard
    - _Bug_Condition: Navigation from tab-group dashboard to root-level reports screen breaks stack_
    - _Expected_Behavior: Moving reports inside tab group unifies navigation context_
    - _Preservation: All other navigation paths remain in their current locations_
    - _Requirements: 2.1_

  - [ ] 3.2 Create reports Stack layout
    - Create file: `app/(tabs)/reports/_layout.jsx`
    - Configure Stack navigator with proper screen options
    - Add Stack.Screen entry for reports/index with headerShown: false
    - Stack configuration ensures reports screen is managed within the tab group context
    - This maintains consistent stack management for back navigation
    - _Bug_Condition: Reports needs proper Stack integration within tab group_
    - _Expected_Behavior: Stack layout provides unified navigation hierarchy_
    - _Preservation: No changes to other Stack layouts or screen configurations_
    - _Requirements: 2.2_

  - [ ] 3.3 Move reports screen into tab group
    - Move file: `app/reports.jsx` → `app/(tabs)/reports/index.jsx`
    - No code changes to the component itself; same logic applies
    - This relocates the screen within the tab hierarchy, unifying the navigation stack
    - _Bug_Condition: isBugCondition(input) - reports at root level causes stack discontinuity_
    - _Expected_Behavior: Reports inside (tabs) group provides proper back navigation_
    - _Preservation: All component functionality remains identical_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.4 Update app/(tabs)/_layout.jsx to add reports screen
    - Add new Tabs.Screen entry for reports with proper configuration
    - Set title to "Reports"
    - Configure tabBarIcon to use Ionicons pie-chart
    - Hide reports from tab bar display using tabBarStyle: { display: 'none' } or similar approach
    - This ensures reports is accessible via tab routing but doesn't clutter the tab bar
    - _Bug_Condition: Reports needs to be registered as a tab screen for proper routing_
    - _Expected_Behavior: Reports can be navigated to via tab routing with proper stack context_
    - _Preservation: Existing tab screen configurations (Home, Sell, Purchase, Accounts) unchanged_
    - _Requirements: 2.2_

  - [ ] 3.5 Update app/_layout.jsx to remove reports from root Stack
    - Remove the `<Stack.Screen name="reports" />` entry from root Stack
    - Keep entries for other root-level screens: inventory, purchase-return, sales-return
    - This eliminates the stack discontinuity that caused the bug
    - _Bug_Condition: Reports at root level creates navigation context mismatch_
    - _Expected_Behavior: Removing from root Stack allows unified tab group context_
    - _Preservation: All other root-level screens remain unchanged_
    - _Requirements: 2.1_

  - [ ] 3.6 Update navigation calls in dashboard
    - Update `app/(tabs)/index.jsx`:
      1. "View All" button in Recent Sales section: `router.push("/(tabs)/reports")`
      2. "View All" button in Recent Procurements section: `router.push("/(tabs)/reports")`
      3. FAB menu "Reports" button: `router.push("/(tabs)/reports")`
    - These updates ensure navigation calls reference the new reports location
    - Expo Router should resolve both `/reports` and `/(tabs)/reports` paths, but using full path is explicit
    - _Bug_Condition: Navigation calls point to root-level reports path_
    - _Expected_Behavior: Navigation calls updated to point to tab-group reports path_
    - _Preservation: All other navigation calls (inventory, purchase-return, sales-return) unchanged_
    - _Requirements: 2.1, 2.2_

  - [ ] 3.7 Verify app structure and imports
    - Confirm all imports are correctly resolved after file moves
    - Verify no broken imports in moved or modified files
    - Check that all required components and utilities are imported correctly
    - _Requirements: 2.1, 2.2_

---

## Phase 3 Validation: Verify Fix Works

- [ ] 4. Verify bug condition exploration test now passes

  - [ ] 4.1 Re-run bug condition test on fixed code
    - **Property 1: Expected Behavior** - Reports Navigation with Correct Back Button
    - **CRITICAL**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior from design
    - When this test passes, it confirms the expected behavior is satisfied
    - Run the bug condition exploration test from step 1 (exact same test code)
    - **Expected Navigation Flow**:
      1. Navigate from dashboard to reports using one of three methods:
         - Click "View All" in Recent Sales
         - Click "View All" in Recent Procurements
         - Open FAB and click Reports
      2. Reports screen should display with all data and functionality
      3. Back button should be visible and functional
      4. Pressing back button should navigate to dashboard
      5. Navigation state should show dashboard as previous screen in stack
    - **Verification Assertions**:
      - Reports screen is visible and fully rendered
      - All report data loads correctly
      - Back button exists and responds to press
      - Back navigation returns to dashboard (not login, not root, not unexpected screen)
      - Navigation stack shows proper hierarchy
      - Multiple back/forward cycles maintain consistency
    - Run test on FIXED code
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - If test still fails, verify implementation is complete and all files are updated
    - _Requirements: 2.1, 2.2_

---

## Phase 3 Validation: Verify Preservation

- [ ] 5. Verify preservation tests still pass

  - [ ] 5.1 Re-run preservation tests on fixed code
    - **Property 2: Preservation** - Non-Reports Navigation Paths Remain Unchanged
    - **CRITICAL**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run all preservation property tests from step 2 (exact same test code)
    - **Verification**: All preservation test cases from task 2 should still pass:
      1. Inter-tab navigation works identically
      2. Inventory navigation preserves behavior
      3. FAB menu non-reports options work correctly
      4. Purchase-return and sales-return navigation unchanged
      5. Internal report navigation unchanged
      6. Dashboard display and state preservation unchanged
      7. Scroll positions and state preserved correctly
    - Run tests on FIXED code
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - If any preservation test fails, revert changes and investigate what broke
    - _Requirements: 3.1, 3.2, 3.3_

---

## Phase 4: Checkpoint

- [ ] 6. Checkpoint - Ensure all tests pass and implementation is complete

  - [ ] 6.1 Run full test suite
    - Execute bug condition exploration test → should PASS
    - Execute all preservation property tests → should all PASS
    - Execute integration tests covering complete user flows:
      1. Login → Dashboard → Reports → Back to Dashboard → Navigate to Inventory
      2. Dashboard → FAB Reports → Reports navigation works
      3. Multiple report tab switches and back navigation
      4. FAB menu cycling through all options
      5. Inter-tab navigation with reports accessible
    - Confirm no broken imports or console errors
    - Verify app builds and runs without errors
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [ ] 6.2 Manual verification (if applicable)
    - Build the app: `npm run build` or `expo build:android`/`expo build:ios`
    - On actual device or simulator:
      1. Navigate from dashboard to reports via each method:
         - View All (Recent Sales)
         - View All (Recent Procurements)
         - FAB Reports button
      2. Verify back button returns to dashboard
      3. Verify reports displays all data correctly
      4. Navigate through internal report tabs (all 5 tabs)
      5. Test export functionality (PDF/CSV) if available
      6. Test filtering and pagination
      7. Navigate back to dashboard and verify metrics unchanged
      8. Use FAB to navigate to other screens and verify back behavior
      9. Switch tabs (Home, Sell, Purchase, Accounts) and verify behavior
      10. Confirm navigation back from inventory works
    - Document any issues or edge cases found
    - _Requirements: All_

  - [ ] 6.3 Final validation
    - Confirm all tests pass without failures
    - Confirm no regressions in other navigation paths
    - Confirm back button behavior is consistent and predictable
    - Verify implementation matches design specifications
    - Ask user if questions arise or additional testing is needed
    - Mark task complete when all validations pass

---

## Test File Organization

Tests should be organized as follows:

```
store-mobile/
  __tests__/
    navigation/
      reports-navigation.test.js
        - Exploratory bug condition tests (Property 1)
        - Preservation property tests (Property 2)
        - Integration tests
```

## Notes

### References to Design Specifications

- **Bug Condition**: Section "Bug Condition" in design.md - isBugCondition(navigationAction)
- **Expected Behavior**: Section "Correctness Properties" - Property 1 in design.md
- **Preservation Requirements**: Section "Correctness Properties" - Property 2 in design.md
- **Implementation Details**: Section "Fix Implementation" in design.md
- **Testing Strategy**: Section "Testing Strategy" in design.md

### Testing Approach

- **Exploratory tests** use property-based testing to generate many navigation scenarios
- **Preservation tests** verify that non-reports navigation behavior is unchanged
- **Integration tests** validate complete user journeys through the app
- **Manual testing** on real devices/simulators provides final validation

### Success Criteria

All tasks are complete when:
1. Exploratory bug condition test FAILS on unfixed code (proves bug exists)
2. Preservation tests PASS on unfixed code (establishes baseline)
3. All implementation tasks are completed
4. Exploratory test PASSES on fixed code (proves bug is fixed)
5. Preservation tests PASS on fixed code (proves no regressions)
6. Manual verification passes on device/simulator

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1", "2"],
      "note": "Run exploratory and preservation tests on UNFIXED code to establish baseline"
    },
    {
      "wave": 2,
      "tasks": ["3"],
      "note": "Implement the fix - all 7 sub-tasks must be completed sequentially"
    },
    {
      "wave": 3,
      "tasks": ["4", "5"],
      "note": "Re-run same tests on FIXED code to validate fix works and preserves behavior"
    },
    {
      "wave": 4,
      "tasks": ["6"],
      "note": "Final checkpoint and integration testing"
    }
  ],
  "taskDependencies": {
    "1": [],
    "2": ["1"],
    "3": ["2"],
    "4": ["3"],
    "5": ["4"],
    "6": ["5"]
  }
}
```
