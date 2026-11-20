CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'operator')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- Profiles: only your own row, or every row for admins (protects email addresses)
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
CREATE POLICY "Users view own profile, admins view all"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Shared shop-floor data: only people with a staff role
DROP POLICY IF EXISTS "Staff view tools" ON public.tools;
CREATE POLICY "Staff view tools"
  ON public.tools FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff view stages" ON public.stages;
CREATE POLICY "Staff view stages"
  ON public.stages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff view history" ON public.tool_events;
CREATE POLICY "Staff view history"
  ON public.tool_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));