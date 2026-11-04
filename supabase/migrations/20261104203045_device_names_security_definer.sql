-- The name generator must see every device's name to stay unique (RLS lets a device see only itself),
-- so both functions run with the owner's rights. Neither is callable directly by clients.
alter function public.generate_device_name() security definer;
alter function public.devices_assign_name() security definer;
