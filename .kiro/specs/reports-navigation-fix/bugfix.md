# Bugfix Requirements: Dashboard Reports Navigation

## Introduction

The mobile dashboard contains "View All" buttons in the "Recent Sales" and "Recent Procurements" sections that navigate to the Reports screen. When users click these buttons, the app navigates to the Reports screen but the screen immediately becomes unresponsive or crashes. Additionally, the back button does not function properly, trapping users on the Reports screen with no way to return to the dashboard.

The root cause is a broken navigation stack created by linking a tab-group screen `(tabs)/index.jsx` to a root-level screen `/reports.jsx`. The Expo Router navigation architecture does not properly maintain the navigation context when crossing from within a tab group to a root-level screen, resulting in navigation state corruption and back button failures.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user clicks "View All" button in "Recent Sales" section from the dashboard THEN the Reports screen loads but becomes unresponsive or crashes

1.2 WHEN the Reports screen is displayed after navigation from dashboard THEN pressing the back button has no effect and user remains trapped on Reports screen

1.3 WHEN the user navigates from dashboard tab-group screen to root-level Reports screen via `router.push("/reports")` THEN the navigation context is lost and the back navigation state is corrupted

### Expected Behavior (Correct)

2.1 WHEN the user clicks "View All" button in "Recent Sales" section from the dashboard THEN the Reports screen SHALL load successfully and remain responsive

2.2 WHEN the Reports screen is displayed THEN pressing the back button SHALL properly return to the calling dashboard screen

2.3 WHEN the user navigates from dashboard tab-group screen to root-level Reports screen THEN the navigation stack SHALL be properly maintained with correct context preservation

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user uses other navigation paths within the tab group (home → pos, home → purchase, home → settings) THEN the system SHALL CONTINUE TO navigate and show back button functionality correctly

3.2 WHEN the user navigates from dashboard to other root-level screens like `/inventory` or `/purchase-return` THEN the system SHALL CONTINUE TO maintain proper navigation state and back functionality

3.3 WHEN the Reports screen is accessed from other navigation paths (e.g., via FAB menu) THEN the system SHALL CONTINUE TO function as designed
