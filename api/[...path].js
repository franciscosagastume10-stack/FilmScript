import requestHandler from "../server.js";

// Vercel maps `api/index.js` only to `/api`. The FilmScript backend also
// serves nested account routes such as `/api/scripts/:id/preproduction/calendar`.
// This catch-all keeps their original pathname and HTTP method intact so saves
// from Calendar, Budget and the production tools reach the same handler.
export default requestHandler;
