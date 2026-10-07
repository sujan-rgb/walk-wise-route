# SafeRoute Explorer

Build the SafeRoute application from the provided SafeRoute prototype (1).html file and specifications. Transform the prototype into a production-ready, modern responsive web application with all core features:

1. Plan Route: Interactive campus map with route options (Fastest, Balanced, Safest), travel mode selection (Walking, Cycling, Campus ride), time of day toggle (Day, Evening, Night) with dynamic weighted scoring (Lighting, Active public places, Help points nearby, Verified reports), factor breakdown bars, and toggleable map layers for lighting, help points, and verified reports.
2. Safe Walk Mode: Opt-in, time-limited location-sharing simulation with configurable duration, selectable trusted contacts, real-time progress along the route, check-in prompts ("I'm okay", simulate missed check-in), and safe arrival confirmation with live activity logs.
3. SOS Emergency: High-visibility SOS trigger with a 5-second cancelable countdown, instant simulated alert broadcast to chosen contacts and campus security, and clear emergency instructions.
4. Community Reporting & Moderation: Report submission form with categories (Broken light, Unsafe path, Harassment concern, Hazard), rate limiting enforcement, and a moderation queue to verify or reject reports, with verified reports dynamically impacting route scores and appearing on the map.
5. Campus Insights: Anonymized aggregation charts of reported issues and actionable maintenance/patrol recommendations for campus safety teams.
6. Clean, accessible UI matching the prototype's Schibsted Grotesk aesthetic, dark/light mode support, and privacy-first disclaimers.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://walk-wise-route.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1b2689be-d88b-4200-9118-9e1aa0dc7a9d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
