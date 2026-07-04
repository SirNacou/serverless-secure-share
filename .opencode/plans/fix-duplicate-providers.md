# Fix: Duplicate Providers Causing Invalid Hook Call

## Problem
`ThemeProvider` wraps `RouterProvider` in `main.tsx`, but `ThemeProvider` uses `<ScriptOnce>` from `@tanstack/react-router`, which requires the router context. The same providers are also duplicated in `__root.tsx`.

## Changes

### 1. `src/frontend/src/main.tsx`
- Remove `ThemeProvider`, `TooltipProvider`, `Toaster` imports
- Keep only `QueryClientProvider` wrapping `RouterProvider`

Final render block:
```tsx
root.render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
)
```

### 2. `src/frontend/src/routes/__root.tsx`
- Remove `Amplify.configure(awsConfig)` (line 12) — already called in `main.tsx`
