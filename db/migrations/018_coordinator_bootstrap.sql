-- 018_coordinator_bootstrap.sql — Phase 6: seed the first network administrator.
-- Additive + idempotent (INSERT OR IGNORE, guarded UPDATE).
--
-- The coordinator table is an allowlist: signing in to Ubuntu Town proves who
-- you are, but only a row here grants authority over centres. That creates a
-- bootstrap problem — with an empty table nobody can get in, including the
-- owner, and there is no first admin to invite anyone else.
--
-- This seeds exactly ONE network administrator: the Ubuntu Town account that
-- owns the platform. Everyone else is invited from inside the console, so this
-- is the only coordinator that ever needs to be created by SQL.
--
-- supabase_user_id is left NULL on purpose: it binds automatically on first
-- sign-in (resolveCoordinator matches on email, then records the Supabase id).
-- That means we never hard-code an auth id, and the row keeps working even if
-- the Supabase user is recreated.

INSERT OR IGNORE INTO coordinators (coordinator_id, supabase_user_id, email, full_name, role, active)
VALUES (
  'coord-network-admin',
  NULL,
  'chiefops26@gmail.com',
  'ChiefOps',
  'network_admin',
  1
);

-- If the row already exists (e.g. added by hand earlier), make sure it is
-- actually an active network admin rather than a plain coordinator.
UPDATE coordinators
   SET role = 'network_admin', active = 1
 WHERE lower(email) = 'chiefops26@gmail.com';
