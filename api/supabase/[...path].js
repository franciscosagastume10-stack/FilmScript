// Isolated Preview route. It intentionally does not import the legacy
// server/database adapters, so enabling this path cannot change AWS traffic.
export { default } from "../../backend/supabase/handler.js";
