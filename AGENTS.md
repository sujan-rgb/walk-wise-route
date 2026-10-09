# AGENTS
- Route scoring, rate-limit and sanitizing rules live in src/lib/saferoute.ts as pure functions — keeps them testable and ready to move server-side.
- The SafeRoute UI is one tabbed client app in src/components/saferoute — state is shared across tabs (walk, SOS, reports affect each other).
- Reports, trusted contacts, profiles and roles live in Lovable Cloud; rate limit (3/hour) and text sanitizing are enforced by a database trigger so clients can't bypass them.
- Reports sync across devices via realtime subscription in src/components/saferoute/useLiveData.ts — one channel, torn down on unmount.
- The first account to sign up is made moderator by the signup trigger; roles live only in user_roles.
- Trip routes come from the planTrip server function (Routes API via connector gateway, sign-in required to bound map costs); results replace the three route slots shortest→Fastest, longest→Safest.
- Distress calling uses tel:/sms: links (phone's own dialer) — free, no paid calling service.
- SOS live location: a live_shares row per SOS, updated from watchPosition; public /live/$id page reads it only via the get_live_share security-definer function (no anon table access).
