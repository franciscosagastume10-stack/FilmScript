export default [{
  files: [
    'collaboration-engine.js',
    'realtime-collaboration.js',
    'realtime-client-source.js',
    'platform-client.js',
    'canvas-workspace.js',
    'backend/supabase/**/*.js',
    'api/supabase/**/*.js',
  ],
  languageOptions: { ecmaVersion:'latest', sourceType:'module' },
  rules: { 'no-constant-binary-expression':'error', 'no-dupe-keys':'error', 'no-unreachable':'error', 'no-self-assign':'error' },
}];
