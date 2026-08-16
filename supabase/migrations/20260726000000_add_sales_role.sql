-- Add a 'sales' base role to profiles.
-- The base role (profiles.role) is what RLS and the app's route/nav gating key
-- off. 'sales' is the role that (with 'admin') may access the CRM section.
-- Widening the CHECK is backwards-compatible: existing rows are unaffected.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'technician', 'sales', 'customer'));
