# Teaching Material Library

**Status:** Draft
**Created:** 2026-07-04

## Problem

Today, "material" (audio/video/image/PDF) is only ever created *at the moment of assignment* — a teacher records or uploads a file inline inside `MakeupAssignPanel` / `BulkHomeworkPanel` / `HomeworkAssignForm`, and it's attached to one assignment. There's no reuse: if the same worksheet or backing track is useful for five students across three weeks, the teacher re-uploads it five times, and nothing is discoverable by other teachers or admins.

## Goal

1. A **Material Library** where teachers record/upload material (audio, video, image, PDF) upfront, tagged with a proper name and an **instrument**, independent of any specific student.
2. When assigning homework/classwork to a student (or group), the teacher can **upload new**, **record new**, or **search the library** and attach an existing item — no re-upload.
3. The library is **shared**: searchable by instrument (and title) by **all teachers and admins**, not siloed per-teacher.

## Assumptions (flag if wrong — no response received on these two, proceeding with the recommended defaults)

- **Video capture = upload only**, no in-browser MediaRecorder video capture in this pass. Teachers shoot video on their phone and upload the file. (Avoids a webcam-preview UI and a video transcode pipeline; can be added later using the same `convertWebmToMp3`-style pattern in `driveService.js` if needed.)
- **Library picker wired into `MakeupAssignPanel.tsx` only** for this pass, since it already has the multi-file array + record/upload UI that's the closest match. `HomeworkAssignForm.tsx` / `BulkHomeworkPanel.tsx` theory-sheet uploads are left as-is; the same picker component can be dropped into them in a follow-up once the pattern is proven.

## Data Model

### New table: `teaching_materials`

```sql
CREATE TABLE teaching_materials (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL,
  description         TEXT,
  instrument_id       UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  material_type       TEXT NOT NULL CHECK (material_type IN ('audio','video','image','document')),
  file_storage_id     UUID NOT NULL REFERENCES file_storage(id) ON DELETE RESTRICT,
  created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teaching_materials_instrument ON teaching_materials (instrument_id) WHERE is_active;
CREATE INDEX idx_teaching_materials_type       ON teaching_materials (material_type);
CREATE INDEX idx_teaching_materials_title      ON teaching_materials (LOWER(title));
```

Search is by `instrument_id` + `ILIKE` on `title` — at HSM's scale (~100–200 students, a few hundred materials at most) a trigram index is unnecessary overhead.

### `homework_attachments` gets one new nullable column

```sql
ALTER TABLE homework_attachments
  ADD COLUMN IF NOT EXISTS source_material_id UUID REFERENCES teaching_materials(id) ON DELETE SET NULL;
```

Traces an attachment back to the library item it came from (nullable — direct uploads have no source). Lets us later show "used N times" on a library item, but isn't required for the picker to work.

### `file_storage` — new category

Add `teaching_material` to `CATEGORY_CONFIG` in `driveService.js`, permanent retention (like `profile_image`/`marketing`, `retentionDays: 0`) since these are durable, reusable assets, not transient submissions.

New env vars: `DRIVE_FOLDER_TEACHING_MATERIALS`, `DRIVE_RETENTION_TEACHING_MATERIALS` (default `0`).

## Backend

### `backend-enroll/services/driveService.js`
- Add `teaching_material` to `CATEGORY_CONFIG`.
- Add `buildMaterialFileName({ instrument, title, originalName, date })` — mirrors existing `buildDriveFileName`, but uses `instrument_title_date` instead of `studentName_instrument_date`.

### New route file: `backend-enroll/routes/materials.js`
Registered in `index.js` as `app.use('/api/materials', require('./routes/materials'))`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/materials` | Create a material. Body: `{ title, description?, instrument_id, material_type, file_data (base64), file_name, mime_type }`. Uploads to Drive (`teaching_material` category), inserts `file_storage` + `teaching_materials` rows. |
| GET | `/api/materials?instrument_id=&type=&q=&limit=` | List/search — filters combine with AND. Returns `public_url`, `title`, `instrument_name`, `material_type`, `created_by` name, `created_at`. |
| GET | `/api/materials/:id` | Single item detail (for preview). |
| DELETE | `/api/materials/:id` | Admin or the creating teacher only. Deletes the Drive file (best-effort, same pattern as `DELETE /homework/:id`) + `file_storage` + `teaching_materials` rows. Blocked (409) if any `homework_attachments` still reference it via `source_material_id` — or allow with a warning that existing assignments keep their file (file_storage row would need to survive); simplest correct behavior: **soft-delete** (`is_active = false`) instead of hard delete, so past assignments are unaffected and it just disappears from search.

All endpoints behind `authenticateJWT` + `authorizeRole(['admin','teacher'])`.

### `backend-enroll/routes/homework.js` — extend `assign-makeup-bulk`
Currently `files: [{ data, name, mimeType }]` are always freshly uploaded. Extend accepted shape per entry to either:
- `{ data, name, mimeType }` → upload as today, **or**
- `{ material_id }` → look up `file_storage_id` from `teaching_materials`, reuse it directly (no re-upload), and set `source_material_id` on the resulting `homework_attachments` row.

This mirrors the existing "upload once, attach the same `file_storage_id` to every target student" pattern already in that endpoint — reusing a library item is the same code path, just skipping the upload step.

## Frontend

### Types & API (`types.ts`, `api.ts`)
- `TeachingMaterial` interface.
- `apiGet('/materials', {...})`, `apiPost('/materials', ...)`, `apiDelete('/materials/:id')`.

### New component: `MaterialLibrary.tsx`
New top-level tab (`materials`), role-gated to `admin`/`teacher`, sidebar entry in `App.tsx`.
- **Create panel**: Title (required text), Instrument (required dropdown from `/api/instruments`), Description (optional), and a record-or-upload widget reusing the existing pattern from `MakeupAssignPanel.tsx` (`MediaRecorder` for audio, `<input type=file accept="video/*,image/*,application/pdf,audio/*">` for everything else). Submits to `POST /api/materials`.
- **Browse/search panel**: instrument filter dropdown, text search box (debounced, hits `GET /api/materials?q=`), type filter chips (Audio/Video/Image/PDF). Grid/list of cards showing title, instrument badge, type icon, uploader, date, inline preview (`<audio>`/`<video>`/`<img>`/PDF link), and a delete button (owner or admin only).

### New reusable component: `MaterialPicker.tsx`
A modal (or inline expandable panel) that wraps the browse/search UI above in "pick" mode — takes an optional `defaultInstrumentId` (pre-filled from the batch's instrument when opened from an assignment flow), lets the teacher multi-select materials, and returns `{ material_id, name, mimeType }[]` to the caller.

### `MakeupAssignPanel.tsx` integration
Currently offers two ways to add a file: **Upload** (`accept="audio/*,video/*,image/*,application/pdf"`) and **Record Audio**. Add a third: **Choose from Library**, opening `MaterialPicker` pre-filtered to the batch's instrument. Selected items get appended to the existing `files` state array alongside recorded/uploaded ones — the array already supports mixed entries, so this is additive, not a rework of that component's submit logic (which needs a small branch: entries with `material_id` skip the base64 `data` field and get forwarded as-is to `assign-makeup-bulk`).

## Migration file

`db/migrations/057_teaching_materials.sql` — the `teaching_materials` table + the `homework_attachments.source_material_id` column, per the SQL above. Update `db/schema.sql` afterward per project convention.

## Build Order

1. **DB**: migration 057, apply, update `schema.sql`.
2. **Backend**: `driveService.js` category + filename helper → `routes/materials.js` (CRUD/search) → register in `index.js` → extend `assign-makeup-bulk` to accept `material_id` entries.
3. **Frontend — Library**: types/api wrappers → `MaterialLibrary.tsx` (create + browse) → wire into `App.tsx` as a new tab.
4. **Frontend — Picker integration**: `MaterialPicker.tsx` → wire into `MakeupAssignPanel.tsx`.
5. **Verify end-to-end**: create a material as a teacher, search for it by instrument, assign it to an absent student via makeup material, confirm the student sees the attachment and the teacher who created the assignment can preview it. Then commit.

## Explicitly out of scope for this pass

- In-browser video recording (upload-only for video, see Assumptions).
- Wiring the picker into `HomeworkAssignForm.tsx` / `BulkHomeworkPanel.tsx` theory-sheet uploads (can follow once this pattern is validated).
- Usage analytics ("used N times") on library items — `source_material_id` is captured now so this is cheap to add later, just not built in this pass.
