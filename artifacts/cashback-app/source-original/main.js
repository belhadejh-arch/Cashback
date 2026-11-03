import worker from './worker.js';
Deno.serve((req) => worker.fetch(req, { SA_KEY: Deno.env.get('SA_KEY') }));
