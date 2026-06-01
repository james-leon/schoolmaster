
## Multi-child parent support

### 1. Database migration
Create `parent_students` link table:
- `id` uuid PK, `parent_profile_id` uuid, `student_id` uuid, `school_id` uuid, `relationship` text, `created_at`
- GRANTs: authenticated SELECT/INSERT/UPDATE/DELETE, service_role ALL
- RLS:
  - Super admin ALL
  - School admin ALL where `school_id = get_user_school_id(auth.uid())`
  - Parent SELECT own rows where `parent_profile_id = auth.uid()`
- Update helper: new SQL function `public.is_parent_of_student(_student_id uuid)` returning boolean (SECURITY DEFINER) — checks `parent_students` for `auth.uid()`.
- Update existing RLS on `students`, `grades`, `attendance`, `invoices`, `payment_records`, `parents` to also allow parent read when `is_parent_of_student(id/student_id)` is true (keep existing `get_user_student_id` fallback for backward compat).
- Backfill: insert link rows from existing `profiles.student_id` (and `student_ids[]`) for parent role profiles.
- Demo: ensure Marcel Ekane linked to Arielle; create "Junior Ekane" in CM2 of Queen Mary demo school and link.

### 2. Server / API
Extend `src/routes/api/public/admin-users.ts` (or admin-api) parent-create action to accept `studentIds: string[]` and insert into `parent_students`. Add actions:
- `link-parent-student` { parentProfileId, studentId, relationship }
- `unlink-parent-student` { id }
- `list-parent-children` { parentProfileId } (admin view)

### 3. Client hook
New `src/lib/useParentChildren.ts`:
- For parent user: query `parent_students` joined with `students` (+ class). Returns `children[]`, `selectedChildId`, `setSelectedChildId` (persisted to localStorage), `selectedChild`.
- Provide React context `ParentChildProvider` mounted in parent route.

### 4. Parent portal UI (`src/routes/parent.tsx`)
- If 0 children: empty state.
- If 1 child: render data directly.
- If ≥2: horizontal child selector cards at top (avatar, name, class) + "Tous mes enfants" tab.
- Tabs: "Vue d'ensemble" (combined) | per-child sections (Mon enfant, Notes, Présences, Paiements) read from `selectedChild`.
- Combined view: total outstanding fees, latest average per child, quick cards.

### 5. Admin UI
- Student detail (`src/routes/eleves.$studentId.tsx`): "Parents liés" section — list linked parent profiles, "Lier à un parent existant" dialog (search parents in school), unlink button.
- Parent creation form (wherever it lives, likely `parametres.tsx` or admin-users page): multi-select children.

### 6. Files
**Create**: migration, `src/lib/useParentChildren.tsx`, `src/components/ChildSelector.tsx`, `src/components/LinkParentDialog.tsx`
**Edit**: `src/routes/api/public/admin-users.ts`, `src/routes/parent.tsx`, `src/routes/eleves.$studentId.tsx`, `src/lib/admin-api.ts`, parent-creation form, `src/lib/seed.ts` (Junior Ekane demo) if applicable.

### Notes
- Keep `profiles.student_id` as "primary child" mirror for backward compat — set to first linked child on changes.
- All parent-side queries use student IDs from the link table; no other student data leaks.
