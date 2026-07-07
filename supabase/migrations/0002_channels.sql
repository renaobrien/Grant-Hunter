-- grants-platform :: widen notification_channels.channel to all supported channels
-- 0001 only allowed ('email','telegram'); the dispatcher (engine/notify.ts) also
-- fans out to Slack + Discord webhooks. Re-scope the CHECK constraint accordingly.

alter table notification_channels drop constraint if exists notification_channels_channel_check;
alter table notification_channels add constraint notification_channels_channel_check
  check (channel in ('email','slack','telegram','discord'));
