# ALT-H security laboratory (Point 8 / 4A-1C)

Disposable PostgreSQL lab that exercises the **ALT-H** controls from PR #25 design.
**Not** product 4A-1C-1. **Not** for production/staging Supabase.

## Prerequisites

- Local PostgreSQL only (`127.0.0.1` / `localhost`)
- Synthetic roles (example):

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE nexora_lab_owner LOGIN PASSWORD 'lab_owner_only_synthetic';
CREATE ROLE nexora_lab_app LOGIN PASSWORD 'lab_app_only_synthetic';
CREATE ROLE nexora_lab_sealer LOGIN PASSWORD 'lab_sealer_only_synthetic';
CREATE DATABASE nexora_point8_4a1c_lab OWNER nexora_lab_owner;
GRANT CONNECT ON DATABASE nexora_point8_4a1c_lab TO nexora_lab_app, nexora_lab_sealer;
SQL
```

## Run

```bash
FR004_DATABASE_URL='postgresql://nexora_lab_owner:lab_owner_only_synthetic@127.0.0.1:5432/nexora_point8_4a1c_lab' \
  npx tsx scripts/validate-point8-4a1c-alth-lab.ts
# or: npm run tenancy:validate-point8-4a1c-alth-lab
```

Results: `lab/point8-4a1c-alth/results/latest.json`

## Notes

- MAC comparison is bytea equality only; **no constant-time claim**.
- Lab evidence policy allows DRAFT candidate + VALIDATED predecessor (4A-1C intent). See docs for PR #24 gap finding.
- Secrets/passwords here are synthetic lab-only strings.
