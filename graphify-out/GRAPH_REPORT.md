# Graph Report - .  (2026-04-28)

## Corpus Check
- 0 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 688 nodes · 691 edges · 89 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Management & Finance Dashboards|Management & Finance Dashboards]]
- [[_COMMUNITY_API & Architecture Documentation|API & Architecture Documentation]]
- [[_COMMUNITY_Payments & Prospect Interaction|Payments & Prospect Interaction]]
- [[_COMMUNITY_Payouts & Intake Scheduling|Payouts & Intake Scheduling]]
- [[_COMMUNITY_Authentication & User Profile|Authentication & User Profile]]
- [[_COMMUNITY_Database Schema & Migrations|Database Schema & Migrations]]
- [[_COMMUNITY_Attendance Dashboard Visuals|Attendance Dashboard Visuals]]
- [[_COMMUNITY_Admin Setup & OAuth|Admin Setup & OAuth]]
- [[_COMMUNITY_Student Enrollment Logic|Student Enrollment Logic]]
- [[_COMMUNITY_Student Details Management|Student Details Management]]
- [[_COMMUNITY_LLM Agent Integration|LLM Agent Integration]]
- [[_COMMUNITY_User Provisioning & Roles|User Provisioning & Roles]]
- [[_COMMUNITY_Chat Session Persistence|Chat Session Persistence]]
- [[_COMMUNITY_Project Tooling & Fonts|Project Tooling & Fonts]]
- [[_COMMUNITY_LLM Client Provider|LLM Client Provider]]
- [[_COMMUNITY_Landing Page Core|Landing Page Core]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Music Instruments (Fees Structure)|Music Instruments (Fees Structure)]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Student Seeding Migration|Student Seeding Migration]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Batch Seeding Migration|Batch Seeding Migration]]
- [[_COMMUNITY_Data Extraction Scripts|Data Extraction Scripts]]
- [[_COMMUNITY_Database Cleanup Utility|Database Cleanup Utility]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 149|Community 149]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 158|Community 158]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 170|Community 170]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 177|Community 177]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 180|Community 180]]
- [[_COMMUNITY_Community 181|Community 181]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 184|Community 184]]
- [[_COMMUNITY_Community 185|Community 185]]
- [[_COMMUNITY_Community 186|Community 186]]
- [[_COMMUNITY_Community 187|Community 187]]
- [[_COMMUNITY_Community 188|Community 188]]
- [[_COMMUNITY_Community 189|Community 189]]
- [[_COMMUNITY_Community 190|Community 190]]

## God Nodes (most connected - your core abstractions)
1. `apiGet()` - 20 edges
2. `apiPost()` - 19 edges
3. `apiPut()` - 16 edges
4. `HSM Frontend README` - 16 edges
5. `Admin Setup README` - 11 edges
6. `HSM Backend API README` - 10 edges
7. `Enrollment Module API Documentation` - 9 edges
8. `apiDelete()` - 8 edges
9. `fetchAll()` - 8 edges
10. `set()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `apiGet()` --calls--> `fetchStatusAndBatches()`  [INFERRED]
  /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/api.ts → /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/components/PaymentModule.tsx
- `apiGet()` --calls--> `fetchNotifications()`  [INFERRED]
  /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/api.ts → /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/components/NotificationsPanel.tsx
- `apiPost()` --calls--> `handleAddNote()`  [INFERRED]
  /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/api.ts → /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/components/ProspectModal.tsx
- `apiPut()` --calls--> `handleSave()`  [INFERRED]
  /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/api.ts → /Users/srinikamukherjee/Documents/HSM-Management/frontend-enroll/src/components/FinanceModule/PayslipsTab.tsx
- `POST /api/enroll` --calls--> `Component: EnrollmentForm.tsx`  [INFERRED]
  backend-enroll/API.md → frontend-enroll/README.md

## Communities

### Community 0 - "Management & Finance Dashboards"
Cohesion: 0.05
Nodes (38): apiDelete(), apiGet(), apiPost(), apiRequest(), handlePaymentSubmit(), flattenEdits(), handleNewRevision(), handleSave() (+30 more)

### Community 1 - "API & Architecture Documentation"
Cohesion: 0.08
Nodes (33): Data Model: One Enrollment Per Student, enrollment_batches table, Enrollment Module API Documentation, API Environment Variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT), GET /api/batches, GET /api/batches/:instrumentId, GET /api/enrollments, GET /api/instruments (+25 more)

### Community 2 - "Payments & Prospect Interaction"
Cohesion: 0.09
Nodes (20): apiPut(), handleEnrollmentSubmit(), editKey(), fetchData(), handleTeacherChange(), saveCredits(), savePaymentDate(), showMessage() (+12 more)

### Community 3 - "Payouts & Intake Scheduling"
Cohesion: 0.1
Nodes (18): resolveInstrument(), groupFeeRows(), buildScheduleGrid(), classifyPeriod(), handleSubmit(), parseBatchDays(), set(), validate() (+10 more)

### Community 4 - "Authentication & User Profile"
Cohesion: 0.11
Nodes (16): fetchData(), handleDevSwitched(), handleLogout(), authenticatedFetch(), decodeToken(), getCurrentUser(), getToken(), handleOAuthCallback() (+8 more)

### Community 5 - "Database Schema & Migrations"
Cohesion: 0.09
Nodes (22): Migration 001, Migration 002, Migration 003, Migration 004, Migration 006, enrollment_batches, enrollments, guardian_relationship (+14 more)

### Community 6 - "Attendance Dashboard Visuals"
Cohesion: 0.1
Nodes (23): Attendance Dashboard Component, Attendance Details Form, Attendance Part 2 UI Screenshot, Absent Status Option, Attendance Status Field, Present Status Option, Attendance Tab, Cancel Button (+15 more)

### Community 7 - "Admin Setup & OAuth"
Cohesion: 0.13
Nodes (19): Admin Account: partho.protim@gmail.com, Script: get-token.js, Google OAuth Flow (Production), JWT Access Token (7 days), POST /api/auth/link/student, POST /api/auth/link/teacher, Script: list-users.js, Admin Setup README (+11 more)

### Community 8 - "Student Enrollment Logic"
Cohesion: 0.27
Nodes (7): handleDay1Change(), handleDay2Change(), handleGradeChange(), handlePayTypeChange(), isVocalInstrument(), makeEnrollmentItem(), resolveFee()

### Community 9 - "Student Details Management"
Cohesion: 0.24
Nodes (4): handleDay1Change(), handleGradeChange(), handleInstrumentSettingChange(), resolveFee()

### Community 10 - "LLM Agent Integration"
Cohesion: 0.24
Nodes (3): callOllama(), postJson(), runLLM()

### Community 11 - "User Provisioning & Roles"
Cohesion: 0.6
Nodes (9): fetchAll(), handleAddRole(), handleMarkActivated(), handleProvision(), handleRemoveProvision(), handleRemoveRole(), handleToggleActive(), showError() (+1 more)

### Community 12 - "Chat Session Persistence"
Cohesion: 0.24
Nodes (4): getRoleDefaultChips(), loadPersistedSession(), makeWelcomeMessage(), useChatSession()

### Community 13 - "Project Tooling & Fonts"
Cohesion: 0.2
Nodes (10): node_modules/next/dist/docs/, Next.js Breaking Changes Warning, @AGENTS.md reference, create-next-app, Development Server, Geist font, next/font, Next.js (+2 more)

### Community 14 - "LLM Client Provider"
Cohesion: 0.44
Nodes (7): callGemini(), callGroq(), callLLM(), callOllama(), callProvider(), callXAI(), withRetry()

### Community 15 - "Landing Page Core"
Cohesion: 0.33
Nodes (4): handleCloseModal(), handleOpenModal(), handler(), handleScroll()

### Community 16 - "Community 16"
Cohesion: 0.32
Nodes (3): isUUID(), resolveBatchId(), resolveStudentId()

### Community 17 - "Community 17"
Cohesion: 0.32
Nodes (5): formatDate(), formatPeriod(), handleDownloadPDF(), handleOpenWhatsApp(), handleSave()

### Community 18 - "Music Instruments (Fees Structure)"
Cohesion: 0.25
Nodes (8): Drums, Fees Structure, Guitar, Keyboard, Octopad, Piano, Tabla, Violin

### Community 20 - "Community 20"
Cohesion: 0.48
Nodes (3): buildScheduleGrid(), classifyPeriod(), parseBatchDays()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (7): Frontend Entry: index.html (HSM Admin Portal), Google Font: Inter, Frontend Main: src/main.tsx, TailwindCSS CDN, Student Intake Form: intake.html, Frontend Intake Entry: src/intake.tsx, Google Font: Playfair Display

### Community 22 - "Community 22"
Cohesion: 0.47
Nodes (3): generateRefreshToken(), generateToken(), refreshAccessToken()

### Community 23 - "Community 23"
Cohesion: 0.47
Nodes (4): buildBatchMessage(), copyToClipboard(), formatTime(), handleCopyAndOpen()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (6): Conversational Enrollment Agent Feature, Multi-Bot Image Asset, Robot Greeting/Speaking State, Robot Happy State, Robot Idle State, Robot Listening State

### Community 26 - "Community 26"
Cohesion: 0.7
Nodes (4): buildWhatsAppMessage(), calcTentativeDate(), formatDate(), openWhatsApp()

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (2): onTouch(), onTouchEnd()

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (2): onTouch(), onTouchEnd()

### Community 29 - "Community 29"
Cohesion: 0.83
Nodes (3): main(), postEndpoint(), testEndpoint()

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): computeClassesRemaining(), fetchStudent360Data()

### Community 31 - "Community 31"
Cohesion: 0.83
Nodes (3): buildTransporter(), sendAbsenceNotification(), sendPaymentReminder()

### Community 32 - "Community 32"
Cohesion: 0.83
Nodes (3): buildWaLink(), formatPhoneForWa(), WhatsAppSyncModal()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (2): ChatMessage(), toWhatsAppText()

### Community 35 - "Community 35"
Cohesion: 0.83
Nodes (3): getBatches(), getTeachers(), Home()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (2): dismissNudge(), handleKey()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (4): Fretboard, Guitar, Guitar Fretboard, Guitar Strings

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (4): Guitar Fretboard, Guitar Frets, Fretboard Inlays, Guitar Strings

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (3): Microphone, Rode, Vocals

### Community 40 - "Student Seeding Migration"
Cohesion: 0.83
Nodes (3): findBestBatchMatch(), parseDayFromBatchString(), seedStudents()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (1): CleffAvatar()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (1): Navbar()

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (1): BookingModal()

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (1): WhyHSM()

### Community 48 - "Community 48"
Cohesion: 1.33
Nodes (3): Guitar Icon, HSM Logo Horizontal, Hyderabad School of Music

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (1): GET()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (2): Cymbal, Snare Drum

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (2): Microphone, Vocals

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (3): Visual Element, Brand Logo, Organization

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (2): Window Controls, Window Icon

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (2): Cymbal, Drum

### Community 55 - "Batch Seeding Migration"
Cohesion: 1.0
Nodes (2): convertTo24Hour(), seedBatches()

### Community 56 - "Data Extraction Scripts"
Cohesion: 1.0
Nodes (2): extractData(), parseCSVLine()

### Community 57 - "Database Cleanup Utility"
Cohesion: 1.0
Nodes (2): cleanupDatabase(), triggerRollback()

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (2): HSM Brand Logo, Hyderabad School of Music

### Community 85 - "Community 85"
Cohesion: 2.0
Nodes (2): Robot Character, Full Rotation Sprite Sheet

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (2): hsm.org.in, Sitemap

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (1): Vercel Triangle Path

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (2): Document Concept, File Icon (SVG)

### Community 149 - "Community 149"
Cohesion: 1.0
Nodes (1): Vocals Instrument Icon

### Community 150 - "Community 150"
Cohesion: 1.0
Nodes (1): Piano Instrument Photo

### Community 151 - "Community 151"
Cohesion: 1.0
Nodes (1): Drums Instrument Icon

### Community 152 - "Community 152"
Cohesion: 1.0
Nodes (1): Guitar Dark Mode Icon

### Community 153 - "Community 153"
Cohesion: 1.0
Nodes (1): Drums Dark Mode Icon

### Community 154 - "Community 154"
Cohesion: 1.0
Nodes (1): Vocals Dark Mode Icon

### Community 155 - "Community 155"
Cohesion: 1.0
Nodes (1): Piano Dark Mode Icon

### Community 156 - "Community 156"
Cohesion: 1.0
Nodes (1): Talking Cleff Mascot

### Community 157 - "Community 157"
Cohesion: 1.0
Nodes (1): Cleff Talking Animation

### Community 158 - "Community 158"
Cohesion: 1.0
Nodes (1): Cleff Rotating Animation

### Community 159 - "Community 159"
Cohesion: 1.0
Nodes (1): Orange Robot Character

### Community 160 - "Community 160"
Cohesion: 1.0
Nodes (1): Cleff Animated Mascot

### Community 161 - "Community 161"
Cohesion: 1.0
Nodes (1): Rotating Cleff Character

### Community 170 - "Community 170"
Cohesion: 1.0
Nodes (1): Piano Keyboard (Dark Lighting)

### Community 171 - "Community 171"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 172 - "Community 172"
Cohesion: 1.0
Nodes (1): White Piano Keyboard Image

### Community 176 - "Community 176"
Cohesion: 1.0
Nodes (1): archive/README.md

### Community 177 - "Community 177"
Cohesion: 1.0
Nodes (1): scripts/README.md

### Community 178 - "Community 178"
Cohesion: 1.0
Nodes (1): instruments

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (1): batches

### Community 180 - "Community 180"
Cohesion: 1.0
Nodes (1): attendance_records

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (1): packages

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (1): teacher_payouts

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (1): holidays

### Community 184 - "Community 184"
Cohesion: 1.0
Nodes (1): audit_logs

### Community 185 - "Community 185"
Cohesion: 1.0
Nodes (1): attendance_status

### Community 186 - "Community 186"
Cohesion: 1.0
Nodes (1): attendance_source

### Community 187 - "Community 187"
Cohesion: 1.0
Nodes (1): enrollment_status

### Community 188 - "Community 188"
Cohesion: 1.0
Nodes (1): holiday_scope

### Community 189 - "Community 189"
Cohesion: 1.0
Nodes (1): Vocals

### Community 190 - "Community 190"
Cohesion: 1.0
Nodes (1): Carnatik

## Knowledge Gaps
- **108 isolated node(s):** `GET /api/batches/:instrumentId`, `DB Migration: 001_update_enrollment_schema.sql`, `Role: admin`, `Role: teacher`, `POST /api/auth/link/teacher` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (5 nodes): `InstrumentShowcase.tsx`, `InstrumentShowcase.tsx`, `cardPosition()`, `onTouch()`, `onTouchEnd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (5 nodes): `TeachersSection.tsx`, `TeachersSection.tsx`, `cardPosition()`, `onTouch()`, `onTouchEnd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (4 nodes): `student360.js`, `credits.js`, `computeClassesRemaining()`, `fetchStudent360Data()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (4 nodes): `ChatMessage()`, `renderContent()`, `toWhatsAppText()`, `ChatMessage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `PublicCleffChat.tsx`, `PublicCleffChat.tsx`, `dismissNudge()`, `handleKey()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (3 nodes): `CleffAvatar()`, `CleffAvatar.tsx`, `CleffAvatar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (3 nodes): `Navbar.tsx`, `Navbar.tsx`, `Navbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (3 nodes): `BookingModal()`, `BookingModal.tsx`, `BookingModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (3 nodes): `WhyHSM.tsx`, `WhyHSM.tsx`, `WhyHSM()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (3 nodes): `route.ts`, `route.ts`, `GET()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (3 nodes): `Cymbal`, `Snare Drum`, `drums_dark.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (3 nodes): `Microphone`, `Vocals`, `vocals_dark.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (3 nodes): `window.svg`, `Window Controls`, `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (3 nodes): `drums.png`, `Cymbal`, `Drum`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Batch Seeding Migration`** (3 nodes): `seed-batches.js`, `convertTo24Hour()`, `seedBatches()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Data Extraction Scripts`** (3 nodes): `extractData()`, `parseCSVLine()`, `extract_unique_values.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Database Cleanup Utility`** (3 nodes): `cleanupDatabase()`, `triggerRollback()`, `cleanup-db.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (2 nodes): `HSM Brand Logo`, `Hyderabad School of Music`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (2 nodes): `Robot Character`, `Full Rotation Sprite Sheet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (2 nodes): `hsm.org.in`, `Sitemap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (2 nodes): `globe.svg`, `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (2 nodes): `vercel.svg`, `Vercel Triangle Path`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (2 nodes): `Document Concept`, `File Icon (SVG)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (1 nodes): `Vocals Instrument Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 150`** (1 nodes): `Piano Instrument Photo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 151`** (1 nodes): `Drums Instrument Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 152`** (1 nodes): `Guitar Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 153`** (1 nodes): `Drums Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 154`** (1 nodes): `Vocals Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 155`** (1 nodes): `Piano Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 156`** (1 nodes): `Talking Cleff Mascot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 157`** (1 nodes): `Cleff Talking Animation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 158`** (1 nodes): `Cleff Rotating Animation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 159`** (1 nodes): `Orange Robot Character`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 160`** (1 nodes): `Cleff Animated Mascot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 161`** (1 nodes): `Rotating Cleff Character`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 170`** (1 nodes): `Piano Keyboard (Dark Lighting)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 171`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 172`** (1 nodes): `White Piano Keyboard Image`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 176`** (1 nodes): `archive/README.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 177`** (1 nodes): `scripts/README.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 178`** (1 nodes): `instruments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (1 nodes): `batches`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (1 nodes): `attendance_records`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (1 nodes): `packages`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (1 nodes): `teacher_payouts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (1 nodes): `holidays`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 184`** (1 nodes): `audit_logs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 185`** (1 nodes): `attendance_status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (1 nodes): `attendance_source`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 187`** (1 nodes): `enrollment_status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 188`** (1 nodes): `holiday_scope`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 189`** (1 nodes): `Vocals`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 190`** (1 nodes): `Carnatik`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiPost()` connect `Management & Finance Dashboards` to `Payments & Prospect Interaction`, `User Provisioning & Roles`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `apiGet()` connect `Management & Finance Dashboards` to `Payments & Prospect Interaction`, `Authentication & User Profile`, `Student Enrollment Logic`, `Student Details Management`, `User Provisioning & Roles`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `apiGet()` (e.g. with `fetchData()` and `loadStudents()`) actually correct?**
  _`apiGet()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `apiPost()` (e.g. with `handleSave()` and `handlePaymentSubmit()`) actually correct?**
  _`apiPost()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `apiPut()` (e.g. with `savePaymentDate()` and `saveCredits()`) actually correct?**
  _`apiPut()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `GET /api/batches/:instrumentId`, `DB Migration: 001_update_enrollment_schema.sql`, `Role: admin` to the rest of the system?**
  _108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Management & Finance Dashboards` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._