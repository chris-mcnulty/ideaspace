---
name: Signal optimistic update race condition
description: staleTime:0 fires an immediate background refetch after setQueryData, overwriting optimistic state
---

## Rule
Before any `queryClient.setQueryData(key, optimisticData)`, call `await queryClient.cancelQueries({ queryKey: key })` to prevent in-flight or immediately-triggered refetches from overwriting the optimistic state.

**Why:** With `staleTime: 0`, setting data via `setQueryData` marks it stale immediately, which can trigger a background refetch before the mutation's PUT has been processed by the server. That refetch returns the old server state and overwrites the optimistic update — the UI briefly shows the new value then snaps back.

**How to apply:** Use `onMutate: async () => { await queryClient.cancelQueries({ queryKey }) }`, set the optimistic data there, and use `onSettled` (not `onSuccess`) for the final invalidation. `onError` should call `invalidate()` + show a toast.
