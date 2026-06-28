ALTER TABLE app_events
ADD COLUMN IF NOT EXISTS client_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_events_client_event_id
ON app_events(client_event_id)
WHERE client_event_id IS NOT NULL;
