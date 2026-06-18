# React hook extraction plan

## Current state
- 5 hooks in `src/hooks/` (`useSwipeBack`, `useLongPress`, `usePullToRefresh`, `useMessagingInboxRealtimeBump`, `useKeyboardInset`)
- Most data fetching is inline `useQuery` in page files
- 8 pages are over 80KB as a direct result

## Extraction targets (in priority order)

### Completed
- [ ] `src/hooks/useTodayPageData.js` (see Session 7)

### Next sprint
- [ ] `src/hooks/useClientDetailData.js`  
  Extract: client profile, weight logs, checkins, programme  
  From: `src/pages/ClientDetail.jsx`  
  Expected saving: ~25KB from ClientDetail

- [ ] `src/hooks/useNutritionData.js`  
  Extract: meal logs, targets, adherence, barcode cache  
  From: `src/pages/Nutrition.jsx` (93KB)  
  Expected saving: ~30KB from Nutrition

- [ ] `src/hooks/useProgressData.js`  
  Extract: weight history, workout stats, exercise trends  
  From: `src/pages/ProgressPage.jsx` (92KB)

- [ ] `src/hooks/useProgramBuilderData.js`  
  Extract: exercise library, programme structure, saves  
  From: `src/pages/ProgramBuilderPageImpl.jsx` (114KB)

### Target state
- 15-20 hooks in `src/hooks/`
- No page file over 50KB
- All data fetching testable in isolation from UI
