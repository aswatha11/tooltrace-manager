# ToolTrace Manager

Build a web app called "ToolTrace: Digital Tooling Process Management and Traceability System" for a manufacturing shop floor (Industry 4.0). It replaces manual paper records for tooling activities.

PROBLEM: Tooling process activities are tracked manually, causing delays in status updates, difficulty finding historical records, and poor traceability.

CORE FEATURES:

1. Login: simple roles (Admin, Operator).

2. Dashboard: cards showing total tools and the count in each stage, a table of all tools with colored status badges, and a chart of tools per stage. Updates in real time.

3. Add Tool: form (tool name, type, description, priority) that auto-generates a unique Tool ID and a QR code.

4. Update Status: a very simple shop-floor screen with large touch-friendly buttons. The operator searches or scans a Tool ID and taps the next stage, adds optional remarks, and it saves with timestamp and operator name.

5. Configurable Process Stages: Admin can add, rename, reorder, and delete stages. Defaults: Design, Material Prep, Machining, Inspection, Storage, Dispatch.

6. Tool History / Traceability: a timeline for each tool showing every stage, who updated it, and when. Full historical records are kept and searchable.

7. Reports: search and filter by tool, stage, date, and operator, with export to CSV.

8. Delay Alerts: highlight tools that stay too long in one stage (configurable time limit).

DESIGN: clean, modern, mobile-friendly UI, blue and white industrial theme, large buttons and minimal typing for the shop floor, dark/light mode.

TECH: React + Tailwind, use Supabase for the database and authentication. Add sample data (about 15 tools in different stages) so the demo looks real.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c3abc84-84d1-4991-86b1-cd3ee16224bc).

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
