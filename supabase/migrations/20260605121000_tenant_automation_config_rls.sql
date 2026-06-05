ALTER TABLE public.tenant_automation_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own tenant automation config" ON public.tenant_automation_configs;
CREATE POLICY "Users can read own tenant automation config"
ON public.tenant_automation_configs
FOR SELECT
USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own tenant automation config" ON public.tenant_automation_configs;
CREATE POLICY "Users can insert own tenant automation config"
ON public.tenant_automation_configs
FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own tenant automation config" ON public.tenant_automation_configs;
CREATE POLICY "Users can update own tenant automation config"
ON public.tenant_automation_configs
FOR UPDATE
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own tenant automation config" ON public.tenant_automation_configs;
CREATE POLICY "Users can delete own tenant automation config"
ON public.tenant_automation_configs
FOR DELETE
USING (auth.uid()::text = user_id);
