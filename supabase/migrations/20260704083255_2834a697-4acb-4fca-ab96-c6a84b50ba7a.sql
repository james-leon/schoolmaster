
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'schools','classes','students','teachers','class_subjects','class_teachers',
    'grades','attendance','fee_types','invoices','payment_records',
    'parents','parent_students','announcements','announcement_reads','academic_years',
    'transactions','transaction_categories','suppliers',
    'budgets','budget_lines',
    'vehicles','drivers','vehicle_documents','transport_routes','route_stops','student_transport',
    'events','timetable',
    'staff','payroll','payroll_history','staff_leave',
    'discipline_records','notifications'
  ];
BEGIN
  -- Ensure the realtime publication exists (created by Supabase by default).
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- Ensure REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry the row (needed for filters).
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

    -- Add to publication only if not already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
