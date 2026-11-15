
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');
CREATE TYPE public.tool_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- New user: profile + role (first user becomes admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email
  );
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Stages
CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  max_hours integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stages TO authenticated;
GRANT ALL ON public.stages TO service_role;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view stages" ON public.stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert stages" ON public.stages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update stages" ON public.stages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete stages" ON public.stages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tools
CREATE SEQUENCE public.tool_code_seq START 1;
GRANT USAGE ON SEQUENCE public.tool_code_seq TO authenticated, service_role;

CREATE TABLE public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_code text NOT NULL UNIQUE DEFAULT ('TT-' || lpad(nextval('public.tool_code_seq')::text, 4, '0')),
  name text NOT NULL,
  type text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority public.tool_priority NOT NULL DEFAULT 'medium',
  current_stage_id uuid REFERENCES public.stages(id) ON DELETE SET NULL,
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT ALL ON public.tools TO service_role;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view tools" ON public.tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff add tools" ON public.tools FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins update tools" ON public.tools FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tools" ON public.tools FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tool events (history)
CREATE TABLE public.tool_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.stages(id) ON DELETE SET NULL,
  stage_name text NOT NULL DEFAULT '',
  from_stage_name text,
  remarks text,
  operator_id uuid,
  operator_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tool_events_tool_idx ON public.tool_events(tool_id, created_at);
CREATE INDEX tool_events_created_idx ON public.tool_events(created_at);
GRANT SELECT, INSERT ON public.tool_events TO authenticated;
GRANT ALL ON public.tool_events TO service_role;
ALTER TABLE public.tool_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff view history" ON public.tool_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff record own updates" ON public.tool_events FOR INSERT TO authenticated WITH CHECK (operator_id = auth.uid());

-- Fill snapshot fields and operator identity before insert
CREATE OR REPLACE FUNCTION public.tool_events_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.operator_id := auth.uid();
    NEW.created_at := now();
    SELECT COALESCE(NULLIF(full_name, ''), email, 'Unknown') INTO NEW.operator_name FROM public.profiles WHERE id = auth.uid();
    NEW.operator_name := COALESCE(NEW.operator_name, 'Unknown');
  END IF;
  IF NEW.stage_id IS NOT NULL THEN
    SELECT name INTO NEW.stage_name FROM public.stages WHERE id = NEW.stage_id;
  END IF;
  SELECT s.name INTO NEW.from_stage_name
    FROM public.tools t JOIN public.stages s ON s.id = t.current_stage_id
    WHERE t.id = NEW.tool_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tool_events_bi BEFORE INSERT ON public.tool_events FOR EACH ROW EXECUTE FUNCTION public.tool_events_before_insert();

-- Move the tool to the new stage after insert
CREATE OR REPLACE FUNCTION public.tool_events_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tools
     SET current_stage_id = NEW.stage_id,
         stage_entered_at = NEW.created_at,
         updated_at = now()
   WHERE id = NEW.tool_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tool_events_ai AFTER INSERT ON public.tool_events FOR EACH ROW EXECUTE FUNCTION public.tool_events_after_insert();

REVOKE EXECUTE ON FUNCTION public.tool_events_before_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tool_events_after_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Realtime
ALTER TABLE public.tools REPLICA IDENTITY FULL;
ALTER TABLE public.tool_events REPLICA IDENTITY FULL;
ALTER TABLE public.stages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tools;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stages;

-- Default stages
INSERT INTO public.stages (name, position, max_hours) VALUES
  ('Design', 1, 72),
  ('Material Prep', 2, 48),
  ('Machining', 3, 96),
  ('Inspection', 4, 24),
  ('Storage', 5, 720),
  ('Dispatch', 6, NULL);

-- Sample tools with history
DO $$
DECLARE
  st uuid[];
  ops text[] := ARRAY['Ravi Kumar','Sneha Iyer','Arjun Singh','Maria Fernandes','Jay Patel'];
  notes text[] := ARRAY[
    'Tool registered, CAD drawing approved',
    'Raw stock cut and issued from stores',
    'CNC roughing and finishing in progress',
    'Dimensional check on CMM',
    'Stored in rack B-14',
    'Packed and dispatched to press shop'];
  rec record;
  tid uuid;
  i int;
  t timestamptz;
BEGIN
  SELECT array_agg(id ORDER BY position) INTO st FROM public.stages;
  FOR rec IN SELECT * FROM (VALUES
    ('Progressive Die PD-220', 'Press Die', '4-station progressive die for bracket stamping', 'high', 3, 150, 40),
    ('Injection Mould IM-45 Housing', 'Injection Mould', '2-cavity mould for ABS sensor housing', 'critical', 4, 130, 30),
    ('Forging Die FD-12 Crankshaft', 'Forging Die', 'Closed die set for crankshaft forging, H13 steel', 'high', 3, 260, 50),
    ('Carbide End Mill Set EM-10', 'Cutting Tool', '10 mm 4-flute carbide end mills, TiAlN coated', 'medium', 6, 300, 50),
    ('Drill Jig DJ-07', 'Jig', 'Drill jig for flange bolt holes, 8 x M10', 'low', 1, 30, 0),
    ('Welding Fixture WF-33', 'Fixture', 'Robotic MIG fixture for chassis cross member', 'medium', 2, 110, 20),
    ('Trim Die TD-18', 'Press Die', 'Trim die for door inner panel', 'medium', 5, 400, 70),
    ('Blow Mould BM-09 Bottle', 'Blow Mould', '1 L PET bottle blow mould, aluminium', 'high', 4, 90, 25),
    ('Broach Tool BR-04 Keyway', 'Cutting Tool', '8 mm keyway broach, HSS', 'medium', 3, 60, 20),
    ('Gauge Fixture GF-21', 'Gauge', 'Checking fixture for bumper bracket', 'low', 2, 50, 30),
    ('Die-Cast Mould DC-60', 'Die Casting Die', 'HPDC mould for gearbox cover', 'critical', 1, 100, 0),
    ('Bending Tool BT-15', 'Press Brake Tool', '90 degree V-die and punch set', 'medium', 3, 120, 30),
    ('Coining Die CD-03', 'Press Die', 'Coining die for washer embossing', 'high', 4, 200, 60),
    ('Assembly Fixture AF-11', 'Fixture', 'Pneumatic assembly fixture for hinge module', 'low', 6, 500, 80),
    ('Rotary Cutter RC-27', 'Cutting Tool', 'Rotary die cutter for gasket sheets', 'medium', 5, 350, 60)
  ) AS v(name, type, descr, prio, reached, start_h, step_h)
  LOOP
    INSERT INTO public.tools (name, type, description, priority, created_at, stage_entered_at)
    VALUES (rec.name, rec.type, rec.descr, rec.prio::public.tool_priority,
            now() - make_interval(hours => rec.start_h), now() - make_interval(hours => rec.start_h))
    RETURNING id INTO tid;
    FOR i IN 1..rec.reached LOOP
      t := now() - make_interval(hours => rec.start_h) + make_interval(hours => (i - 1) * rec.step_h);
      INSERT INTO public.tool_events (tool_id, stage_id, remarks, operator_name, created_at)
      VALUES (tid, st[i], notes[i], ops[1 + ((i + length(rec.name)) % 5)], t);
    END LOOP;
  END LOOP;
END $$;
