import posthog from 'posthog-js';

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  enableExceptionAutocapture: true,
  person_profiles: 'identified_only',
});

export default posthog;
