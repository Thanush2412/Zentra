# UI Issues Audit Report

## Summary
I reviewed the main user-facing dashboards and landing flow for visual and interaction issues. The app is feature-rich, but several screens rely on hardcoded data, dense layouts, or special-case UI handling that can confuse users or make the experience feel inconsistent.

## High Priority Issues

### 1. Hardcoded demo / placeholder content leaks into real user flows
- The student dashboard includes a mock library dataset and sample task cards, which can look like live features even when they are not backed by the database.
- The demo allocator dashboard starts with a fixed date instead of the current day, which makes the page feel stale or incorrect.

Files:
- [`src/components/StudentDashboard.tsx`](F:/FP%20time%20table%20system/src/components/StudentDashboard.tsx)
- [`src/components/DemoAllocationDashboard.tsx`](F:/FP%20time%20table%20system/src/components/DemoAllocationDashboard.tsx)

### 2. Some role identity UI is hardcoded instead of driven from the active profile
- The global top bar uses fallback strings for certain roles, especially fee manager and allocator.
- This can show the wrong identity if the session state changes or if the user data is not loaded exactly as expected.

File:
- [`src/components/DashboardLayout.tsx`](F:/FP%20time%20table%20system/src/components/DashboardLayout.tsx)

### 3. Certain dashboards are extremely dense
- The admin, CAM, and KAM screens pack a large amount of data and controls into one view.
- On smaller screens this increases scroll fatigue, raises misclick risk, and makes key actions harder to discover.

Files:
- [`src/components/AdminDashboard.tsx`](F:/FP%20time%20table%20system/src/components/AdminDashboard.tsx)
- [`src/components/CAMDashboard.tsx`](F:/FP%20time%20table%20system/src/components/CAMDashboard.tsx)
- [`src/components/KAMDashboard.tsx`](F:/FP%20time%20table%20system/src/components/KAMDashboard.tsx)

## Medium Priority Issues

### 4. Empty states are weak or generic in some areas
- Several sections fall back to simple placeholder text when there is no data.
- Some of those states do not explain what the user should do next, which makes the interface feel unfinished.

Affected areas:
- Student portal
- Admin tables
- SME/demo swap views

### 5. The app mixes polished UI with obvious mock data
- Some pages feel production-ready while others still expose toy data or fallback content.
- This creates a visual trust gap because users cannot easily tell what is real and what is sample content.

Files:
- [`src/components/StudentDashboard.tsx`](F:/FP%20time%20table%20system/src/components/StudentDashboard.tsx)
- [`src/components/DemoAllocationDashboard.tsx`](F:/FP%20time%20table%20system/src/components/DemoAllocationDashboard.tsx)

### 6. Special-role handling is visually inconsistent
- `fee_manager`, `allocator`, and `sme` are handled differently from the main role set.
- Their UIs work, but the visual and behavioral patterns are not as consistent as the mentor, CAM, KAM, admin, and student paths.

Files:
- [`src/components/DashboardLayout.tsx`](F:/FP%20time%20table%20system/src/components/DashboardLayout.tsx)
- [`src/context/AppContext.tsx`](F:/FP%20time%20table%20system/src/context/AppContext.tsx)

## Low Priority Issues

### 7. Some screens are missing stronger visual hierarchy
- There are areas where typography, spacing, and section separation could be improved.
- This is most noticeable in long administrative views where many controls sit at the same visual weight.

### 8. A few UI states look unfinished
- Some pages have local state and control affordances that are not fully used.
- This can make a page feel like it has extra controls that do not yet do much.

## Screen-by-Screen Notes

### Login / Landing
- The main login flow is functional, but some elements are more about presentation than behavior.
- Hardcoded fallback text and demo interactions can make the screen feel less trustworthy if the local state is incomplete.

### Admin
- Biggest issue is density.
- It has a lot of functionality, but the current layout can feel crowded and overloaded.

### CAM / KAM
- These dashboards contain strong operational data, but the amount of inline content and nested sections can make navigation heavy.

### Mentor
- Feature-rich and reasonably structured, but still benefits from clearer separation between timetable, attendance, handover, and tracker tasks.

### Student
- The mix of real data and mock modules is the biggest concern.
- Library and task areas especially need clearer separation between demo and live features.

### SME / Demo Allocator
- These portals are powerful, but the scheduling views can feel visually busy.
- The default date handling in the allocator is the most obvious user-facing UI defect.

## Recommended Fix Order

1. Remove or clearly label mock/demo content in the student and allocator screens.
2. Replace hardcoded role identity fallbacks with profile-driven UI.
3. Improve empty states so they explain the next step.
4. Reduce density in admin, CAM, and KAM views.
5. Tighten consistency for special roles like fee manager, allocator, and SME.

## Notes
- This audit focuses on UI and UX issues, not login/security bugs.
- If you want, I can turn this into a more actionable checklist with exact fix tasks for each component.
