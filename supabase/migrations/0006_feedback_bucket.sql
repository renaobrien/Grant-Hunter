-- grants-platform :: public Storage bucket for in-app feedback screenshots.
-- Screenshots are uploaded here (server-side, service role) and their public
-- URL is embedded in the GitHub issue the feedback button files. Public read so
-- GitHub can render the image; writes only happen via the service role, so no
-- object-level RLS policies are required.

insert into storage.buckets (id, name, public)
values ('feedback', 'feedback', true)
on conflict (id) do nothing;
