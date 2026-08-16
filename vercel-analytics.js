// Vercel Web Analytics
// This file initializes Vercel Web Analytics for the FilmScript application.
// Analytics are automatically enabled when deployed to Vercel.

(function() {
  // Inject Vercel Web Analytics script
  // The script is loaded asynchronously and will not block page rendering
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://cdn.vercel-insights.com/v1/script.js';
  
  // Append the script to the document head
  if (document.head) {
    document.head.appendChild(script);
  } else {
    // Fallback: wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(script);
    });
  }
})();
