# AGENTS
- Route scoring, rate-limit and sanitizing rules live in src/lib/saferoute.ts as pure functions — keeps them testable and ready to move server-side.
- The SafeRoute UI is one tabbed client app in src/components/saferoute — state is shared across tabs (walk, SOS, reports affect each other).
- Reports, trusted contacts, profiles and roles live in Lovable Cloud; rate limit (3/hour) and text sanitizing are enforced by a database trigger so clients can't bypass them.
- Reports sync across devices via realtime subscription in src/components/saferoute/useLiveData.ts — one channel, torn down on unmount.
- The first account to sign up is made moderator by the signup trigger; roles live only in user_roles.
