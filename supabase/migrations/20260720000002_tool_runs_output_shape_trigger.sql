-- Make output_shape forward-fill live at the database layer.
--
-- The edge writer (runTool) now sets output_shape on insert, but that only
-- takes effect once every tool function is redeployed. A BEFORE INSERT trigger
-- guarantees the column is populated for *every* new tool_run regardless of
-- which code path created it, and can never break tool execution. If a caller
-- already supplied output_shape, we keep it; otherwise we derive it from
-- tool_key via the canonical mapping.

CREATE OR REPLACE FUNCTION public.set_tool_run_output_shape()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.output_shape IS NULL THEN
    NEW.output_shape := public.tool_output_shape(NEW.tool_key);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tool_runs_output_shape ON public.tool_runs;

CREATE TRIGGER trg_tool_runs_output_shape
  BEFORE INSERT ON public.tool_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tool_run_output_shape();
