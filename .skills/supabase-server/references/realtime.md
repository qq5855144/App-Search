# Supabase Realtime (low-frequency feature, read on demand)

## When to Use

Use:
- Requires real-time interaction with low-latency, synchronized display
- Multiple clients need to stay in sync on the same data stream
- Backend-triggered updates (DB changes, presence, broadcast) need to be reflected immediately in the UI

Do NOT use:
- Data can be fetched on-demand or refreshed periodically
- High-frequency updates but no need for synchronized UI (e.g., analytics, logs)

## Server-Side: Enable Realtime Replication

```sql
alter publication supabase_realtime add table your_table_name;
```

After enabling, check again whether the monitored table has Supabase Realtime enabled.

## Client-Side: Subscribe to postgres_changes (Web / MiniProgram)

```js
const channel = supabase
  .channel('db-changes')
  .on(
    'postgres_changes',
    {
      event: '*',              // INSERT | UPDATE | DELETE | *
      schema: 'public',
      table: 'messages',
      // filter: 'room_id=eq.123'  // optional row-level filter
    },
    (payload) => {
      // handle realtime update
    }
  )
  .subscribe();

// Unsubscribe when no longer needed to release resources
// channel.unsubscribe();
```

Clients update UI immediately based on the payload.

## Stack Differences

| Stack | Support | Notes |
|-------|---------|-------|
| Web (Vite) | Full | Direct subscription |
| MiniProgram (Taro/weapp) | Supported | Polling intervals > 0.2s are forbidden due to performance constraints; prefer Realtime |
| Expo / React Native | **Phase-1 NOT supported** | WebSocket stability in RN needs validation; use pull-to-refresh or configurable-interval polling instead |

## Multi-Identity Scenarios

Identity selection / role assignment logic **must NOT** be placed on the frontend — it **MUST** be encapsulated in an Edge Function.
