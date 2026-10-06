# AGENTS
- Route scoring, rate-limit and sanitizing rules live in src/lib/saferoute.ts as pure functions — keeps them testable and ready to move server-side.
- The SafeRoute UI is one tabbed client app in src/components/saferoute — state is shared across tabs (walk, SOS, reports affect each other).
