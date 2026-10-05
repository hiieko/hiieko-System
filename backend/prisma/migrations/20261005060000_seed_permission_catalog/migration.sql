-- Canonical module/action permission catalog.
-- Role grants are intentionally not assigned here: those are business authorization
-- decisions and must be reviewed before access is granted to non-global roles.
-- Idempotent: existing (module, action) rows are preserved.

INSERT INTO permissions (id, module, action, description, created_at)
SELECT
  (
    substr(md5('hiieko:permission:' || module || ':' || action), 1, 8) || '-' ||
    substr(md5('hiieko:permission:' || module || ':' || action), 9, 4) || '-' ||
    substr(md5('hiieko:permission:' || module || ':' || action), 13, 4) || '-' ||
    substr(md5('hiieko:permission:' || module || ':' || action), 17, 4) || '-' ||
    substr(md5('hiieko:permission:' || module || ':' || action), 21, 12)
  )::uuid,
  module,
  action,
  'Canonical permission catalog entry',
  NOW()
FROM (
  VALUES
    ('users'), ('roles'), ('permissions'), ('employees'), ('teams'),
    ('projects'), ('project-stages'), ('tasks'), ('task-dependencies'),
    ('attendance'), ('daily-plans'), ('daily-reports'), ('materials'),
    ('inventory'), ('warehouses'), ('procurement'), ('suppliers'),
    ('documents'), ('ocr'), ('expenses'), ('upload'), ('qa-qc'),
    ('issues'), ('change-orders'), ('costs'), ('notifications'),
    ('control-tower'), ('solar'), ('audit')
) AS modules(module)
CROSS JOIN (
  VALUES ('read'), ('create'), ('update'), ('delete')
) AS actions(action)
ON CONFLICT (module, action) DO NOTHING;
