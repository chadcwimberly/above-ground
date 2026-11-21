-- Web tips in test mode: 'web-test' rows are used by deploy previews and local builds, 'web' rows by the live
-- site (aboveground.app). Live links go in the 'web' rows once Stripe is in live mode.
alter table public.tip_options drop constraint tip_options_platform_check;
alter table public.tip_options add constraint tip_options_platform_check check (platform in ('ios', 'android', 'web', 'web-test'));
-- Rows (test links, contact_email and contact_line in app_copy) live only in the database.
