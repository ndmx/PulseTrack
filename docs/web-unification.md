# PulseTrack and PulseTrackr: one product, two surfaces

PulseTrack is the umbrella website at `pulsetracker.org`. PulseTrackr is its
iPhone community safety experience. Both use Firebase project
`pulsetracker-0000`. Civic insights are retained at `/insights`; safety is the
website home page.

| Capability | iPhone app | Website direction |
| --- | --- | --- |
| Live incident feed and approximate map | Existing | Map-first home and `/feed`; last 24 hours and 150 most recent public reports, including a map when the feed is empty |
| Nearby discovery | Location-aware app feed | Browser location filter over current snapshot; full geoquery remains future work |
| Community incident report | App capture with optional evidence | Text and location submission wired to the same TypeScript callable; switch on only after web App Check setup |
| Community signals and concern reports | Existing callables and app UI | Add after browser identity, moderation, and abuse handling are verified |
| Incident detail and sharing | App detail and `/i/{id}` link | Browser detail at `/incident/{id}`; shared link renders server-side preview |
| SOS and trusted contacts | App only | Link to the app and explain requirements; no browser SOS control |
| Escort, background location, push alerts | App only | Keep on iPhone, where device and operating-system support exist |
| Political sentiment and demographics | Earlier website | Retain direct links at `/insights` and `/snapstats` as archive material; remove them from the primary safety navigation |

## Shared Firebase ownership

- PulseTrack owns Hosting, the merged Firestore rules, and the existing Python
  civic-insights functions. Its Hosting config routes `/i/**` to the PulseTrackr
  TypeScript `incident_share_page` function.
- PulseTrackr owns the `pulsetrackr-sos` TypeScript functions codebase and Storage
  rules. Its `submit_incident` callable is the authoritative incident writer.
- The uncommitted Python `submit_incident` draft in the PulseTrack checkout uses a
  different schema and privacy implementation. Do not deploy it with the same
  callable name. Retain it locally until its useful ideas are reconciled with
  the TypeScript service.

## Release checks

1. Configure Firebase App Check for the PulseTrack web app with reCAPTCHA
   Enterprise, then set `VITE_FIREBASE_APP_CHECK_SITE_KEY` and
   `VITE_PULSETRACKR_REPORTING_ENABLED=true` for the frontend build.
2. Verify that the TypeScript `submit_incident` and `incident_share_page`
   functions are deployed and that anonymous Firebase Auth is enabled.
3. Deploy merged Firestore rules from this repository. Deploy the TypeScript
   functions from PulseTrackr, and Hosting from this repository. Scope each
   deploy by product to avoid replacing the other product's Firebase resources.
4. Verify an actual web report appears in both the web feed and the iPhone app,
   with private coordinates absent from public documents; verify `/i/{id}` in
   a browser and as an iPhone universal link.
5. Treat an empty feed as no reports within the live window. The older seeded
   simulation reports remain in Firestore but are not shown as current events.
