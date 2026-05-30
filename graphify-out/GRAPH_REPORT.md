# Graph Report - HSM-Management  (2026-05-30)

## Corpus Check
- 195 files · ~2,040,074 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 836 nodes · 918 edges · 94 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 137 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
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
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
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
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 174|Community 174]]
- [[_COMMUNITY_Community 175|Community 175]]
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
- [[_COMMUNITY_Community 191|Community 191]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 193|Community 193]]
- [[_COMMUNITY_Community 194|Community 194]]
- [[_COMMUNITY_Community 195|Community 195]]
- [[_COMMUNITY_Community 196|Community 196]]
- [[_COMMUNITY_Community 197|Community 197]]
- [[_COMMUNITY_Community 198|Community 198]]
- [[_COMMUNITY_Community 199|Community 199]]
- [[_COMMUNITY_Community 200|Community 200]]
- [[_COMMUNITY_Community 201|Community 201]]
- [[_COMMUNITY_Community 202|Community 202]]
- [[_COMMUNITY_Community 203|Community 203]]
- [[_COMMUNITY_Community 204|Community 204]]
- [[_COMMUNITY_Community 205|Community 205]]

## God Nodes (most connected - your core abstractions)
1. `apiGet()` - 33 edges
2. `apiPost()` - 33 edges
3. `apiPut()` - 22 edges
4. `HSM Frontend README` - 16 edges
5. `apiDelete()` - 13 edges
6. `Admin Setup README` - 11 edges
7. `HSM Backend API README` - 10 edges
8. `GET()` - 9 edges
9. `getCurrentUser()` - 9 edges
10. `Enrollment Module API Documentation` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `handleOAuthCallback()`  [INFERRED]
  frontend-landing/app/robots.txt/route.ts → frontend-enroll/src/auth.ts
- `setCached()` --calls--> `set()`  [INFERRED]
  backend-enroll/llm/rateLimit.js → frontend-enroll/src/intake.tsx
- `extractData()` --calls--> `set()`  [INFERRED]
  db/migrations/Prod_DataMigration/extract_unique_values.js → frontend-enroll/src/intake.tsx
- `extractData()` --calls--> `GET()`  [INFERRED]
  db/migrations/Prod_DataMigration/extract_unique_values.js → frontend-landing/app/robots.txt/route.ts
- `GET()` --calls--> `getCached()`  [INFERRED]
  frontend-landing/app/robots.txt/route.ts → backend-enroll/llm/rateLimit.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (57): apiGet(), apiPost(), discardRecording(), fetchManageHabits(), fetchPredefined(), fetchStudents(), handleAssign(), handleAssignHabit() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (24): resolveInstrument(), extractData(), parseCSVLine(), flattenEdits(), groupFeeRows(), handleNewRevision(), handleSave(), buildScheduleGrid() (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (33): Data Model: One Enrollment Per Student, enrollment_batches table, Enrollment Module API Documentation, API Environment Variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT), GET /api/batches, GET /api/batches/:instrumentId, GET /api/enrollments, GET /api/instruments (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (20): apiPut(), apiRequest(), handleUpdateHabit(), formatDemoDate(), getWhatsAppUrl(), handleSaveSlot(), gradeTheoryAnswer(), saveEdit() (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (15): fetchData(), handleDevSwitched(), handleLogout(), authenticatedFetch(), decodeToken(), getCurrentUser(), getToken(), handleOAuthCallback() (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (22): Migration 001, Migration 002, Migration 003, Migration 004, Migration 006, enrollment_batches, enrollments, guardian_relationship (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (15): discardInstRecording(), discardRecording(), handleAssign(), handleDelete(), handleExpandToggle(), handleFileUpload(), handleInstFileUpload(), handlePlaySub() (+7 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (23): Attendance Dashboard Component, Attendance Details Form, Attendance Part 2 UI Screenshot, Absent Status Option, Attendance Status Field, Present Status Option, Attendance Tab, Cancel Button (+15 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (19): Admin Account: partho.protim@gmail.com, Script: get-token.js, Google OAuth Flow (Production), JWT Access Token (7 days), POST /api/auth/link/student, POST /api/auth/link/teacher, Script: list-users.js, Admin Setup README (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (10): discardVoiceNote(), dismissVoiceNote(), fetchHabits(), fetchPredefined(), handleTheorySkip(), handleTheorySubmit(), performToggle(), sendVoiceNote() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (11): buildDriveFileName(), cleanupExpired(), deleteFile(), getAuthClient(), getCategoryConfig(), getDriveClient(), _safePart(), upload() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.31
Nodes (14): apiDelete(), handleDeleteHabit(), archiveHabit(), handleDeleteInst(), handleDeleteStudent(), fetchAll(), handleAddRole(), handleMarkActivated() (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (11): computeStreaks(), fmt(), formatDate(), formatPeriod(), handleDownloadPDF(), handleOpenWhatsApp(), handleSave(), awardXP() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (9): handleDay1Change(), handleDay2Change(), handleEnrollmentSubmit(), handleGradeChange(), handlePaymentSubmit(), handlePayTypeChange(), isVocalInstrument(), makeEnrollmentItem() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.42
Nodes (10): handleWebhookPayload(), getOptedInPhone(), isEnabled(), logMessage(), normalizePhone(), notifyAttendancePresent(), notifyClassesLow(), notifyEnrollmentWelcome() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (8): editKey(), fetchData(), handleTeacherChange(), saveCredits(), savePaymentDate(), showMessage(), startEditClasses(), startEditPayment()

### Community 16 - "Community 16"
Cohesion: 0.24
Nodes (4): handleDay1Change(), handleGradeChange(), handleInstrumentSettingChange(), resolveFee()

### Community 17 - "Community 17"
Cohesion: 0.31
Nodes (5): fetchConfig(), handleCloseModal(), handleOpenModal(), handler(), handleScroll()

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (3): callOllama(), postJson(), runLLM()

### Community 19 - "Community 19"
Cohesion: 0.24
Nodes (4): getRoleDefaultChips(), loadPersistedSession(), makeWelcomeMessage(), useChatSession()

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (10): node_modules/next/dist/docs/, Next.js Breaking Changes Warning, @AGENTS.md reference, create-next-app, Development Server, Geist font, next/font, Next.js (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.44
Nodes (7): callGemini(), callGroq(), callLLM(), callOllama(), callProvider(), callXAI(), withRetry()

### Community 22 - "Community 22"
Cohesion: 0.32
Nodes (3): isUUID(), resolveBatchId(), resolveStudentId()

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (8): Drums, Fees Structure, Guitar, Keyboard, Octopad, Piano, Tabla, Violin

### Community 24 - "Community 24"
Cohesion: 0.48
Nodes (3): buildScheduleGrid(), classifyPeriod(), parseBatchDays()

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (7): Frontend Entry: index.html (HSM Admin Portal), Google Font: Inter, Frontend Main: src/main.tsx, TailwindCSS CDN, Student Intake Form: intake.html, Frontend Intake Entry: src/intake.tsx, Google Font: Playfair Display

### Community 27 - "Community 27"
Cohesion: 0.47
Nodes (3): generateRefreshToken(), generateToken(), refreshAccessToken()

### Community 28 - "Community 28"
Cohesion: 0.47
Nodes (4): buildBatchMessage(), copyToClipboard(), formatTime(), handleCopyAndOpen()

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (6): Conversational Enrollment Agent Feature, Multi-Bot Image Asset, Robot Greeting/Speaking State, Robot Happy State, Robot Idle State, Robot Listening State

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): onTouch(), onTouchEnd()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (2): onTouch(), onTouchEnd()

### Community 34 - "Community 34"
Cohesion: 0.7
Nodes (4): buildWhatsAppMessage(), calcTentativeDate(), formatDate(), openWhatsApp()

### Community 35 - "Community 35"
Cohesion: 0.83
Nodes (3): findBestBatchMatch(), parseDayFromBatchString(), seedStudents()

### Community 36 - "Community 36"
Cohesion: 0.83
Nodes (3): getBatches(), getTeachers(), Home()

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (2): dismissNudge(), handleKey()

### Community 38 - "Community 38"
Cohesion: 0.83
Nodes (3): main(), postEndpoint(), testEndpoint()

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (2): computeClassesRemaining(), fetchStudent360Data()

### Community 40 - "Community 40"
Cohesion: 0.83
Nodes (3): buildTransporter(), sendAbsenceNotification(), sendPaymentReminder()

### Community 41 - "Community 41"
Cohesion: 0.83
Nodes (3): buildWaLink(), formatPhoneForWa(), WhatsAppSyncModal()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (2): ChatMessage(), toWhatsAppText()

### Community 44 - "Community 44"
Cohesion: 0.5
Nodes (4): Fretboard, Guitar, Guitar Fretboard, Guitar Strings

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (4): Guitar Fretboard, Guitar Frets, Fretboard Inlays, Guitar Strings

### Community 46 - "Community 46"
Cohesion: 0.5
Nodes (3): Microphone, Rode, Vocals

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (1): createCard()

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (2): convertTo24Hour(), seedBatches()

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (2): cleanupDatabase(), triggerRollback()

### Community 50 - "Community 50"
Cohesion: 0.67
Nodes (1): CleffAvatar()

### Community 51 - "Community 51"
Cohesion: 0.67
Nodes (1): Navbar()

### Community 52 - "Community 52"
Cohesion: 0.67
Nodes (1): BookingModal()

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (1): WhyHSM()

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (2): getRankInfo(), XPBadge()

### Community 60 - "Community 60"
Cohesion: 1.33
Nodes (3): Guitar Icon, HSM Logo Horizontal, Hyderabad School of Music

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (2): Cymbal, Snare Drum

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (2): Microphone, Vocals

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (3): Visual Element, Brand Logo, Organization

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (2): Window Controls, Window Icon

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (2): Cymbal, Drum

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (2): HSM Brand Logo, Hyderabad School of Music

### Community 104 - "Community 104"
Cohesion: 2.0
Nodes (2): Robot Character, Full Rotation Sprite Sheet

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (2): hsm.org.in, Sitemap

### Community 106 - "Community 106"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 107 - "Community 107"
Cohesion: 1.0
Nodes (1): Vercel Triangle Path

### Community 108 - "Community 108"
Cohesion: 1.0
Nodes (2): Document Concept, File Icon (SVG)

### Community 172 - "Community 172"
Cohesion: 1.0
Nodes (1): Vocals Instrument Icon

### Community 173 - "Community 173"
Cohesion: 1.0
Nodes (1): Piano Instrument Photo

### Community 174 - "Community 174"
Cohesion: 1.0
Nodes (1): Drums Instrument Icon

### Community 175 - "Community 175"
Cohesion: 1.0
Nodes (1): Guitar Dark Mode Icon

### Community 176 - "Community 176"
Cohesion: 1.0
Nodes (1): Drums Dark Mode Icon

### Community 177 - "Community 177"
Cohesion: 1.0
Nodes (1): Vocals Dark Mode Icon

### Community 178 - "Community 178"
Cohesion: 1.0
Nodes (1): Piano Dark Mode Icon

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (1): Talking Cleff Mascot

### Community 180 - "Community 180"
Cohesion: 1.0
Nodes (1): Cleff Talking Animation

### Community 181 - "Community 181"
Cohesion: 1.0
Nodes (1): Cleff Rotating Animation

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (1): Orange Robot Character

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (1): Cleff Animated Mascot

### Community 184 - "Community 184"
Cohesion: 1.0
Nodes (1): Rotating Cleff Character

### Community 185 - "Community 185"
Cohesion: 1.0
Nodes (1): Piano Keyboard (Dark Lighting)

### Community 186 - "Community 186"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 187 - "Community 187"
Cohesion: 1.0
Nodes (1): White Piano Keyboard Image

### Community 191 - "Community 191"
Cohesion: 1.0
Nodes (1): archive/README.md

### Community 192 - "Community 192"
Cohesion: 1.0
Nodes (1): scripts/README.md

### Community 193 - "Community 193"
Cohesion: 1.0
Nodes (1): instruments

### Community 194 - "Community 194"
Cohesion: 1.0
Nodes (1): batches

### Community 195 - "Community 195"
Cohesion: 1.0
Nodes (1): attendance_records

### Community 196 - "Community 196"
Cohesion: 1.0
Nodes (1): packages

### Community 197 - "Community 197"
Cohesion: 1.0
Nodes (1): teacher_payouts

### Community 198 - "Community 198"
Cohesion: 1.0
Nodes (1): holidays

### Community 199 - "Community 199"
Cohesion: 1.0
Nodes (1): audit_logs

### Community 200 - "Community 200"
Cohesion: 1.0
Nodes (1): attendance_status

### Community 201 - "Community 201"
Cohesion: 1.0
Nodes (1): attendance_source

### Community 202 - "Community 202"
Cohesion: 1.0
Nodes (1): enrollment_status

### Community 203 - "Community 203"
Cohesion: 1.0
Nodes (1): holiday_scope

### Community 204 - "Community 204"
Cohesion: 1.0
Nodes (1): Vocals

### Community 205 - "Community 205"
Cohesion: 1.0
Nodes (1): Carnatik

## Knowledge Gaps
- **108 isolated node(s):** `GET /api/batches/:instrumentId`, `DB Migration: 001_update_enrollment_schema.sql`, `Role: admin`, `Role: teacher`, `POST /api/auth/link/teacher` (+103 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (5 nodes): `InstrumentShowcase.tsx`, `InstrumentShowcase.tsx`, `cardPosition()`, `onTouch()`, `onTouchEnd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (5 nodes): `TeachersSection.tsx`, `TeachersSection.tsx`, `cardPosition()`, `onTouch()`, `onTouchEnd()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (4 nodes): `PublicCleffChat.tsx`, `PublicCleffChat.tsx`, `dismissNudge()`, `handleKey()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (4 nodes): `student360.js`, `credits.js`, `computeClassesRemaining()`, `fetchStudent360Data()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (4 nodes): `ChatMessage()`, `renderContent()`, `toWhatsAppText()`, `ChatMessage.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (3 nodes): `script.js`, `script.js`, `createCard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (3 nodes): `seed-batches.js`, `convertTo24Hour()`, `seedBatches()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (3 nodes): `cleanupDatabase()`, `triggerRollback()`, `cleanup-db.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (3 nodes): `CleffAvatar()`, `CleffAvatar.tsx`, `CleffAvatar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (3 nodes): `Navbar.tsx`, `Navbar.tsx`, `Navbar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (3 nodes): `BookingModal()`, `BookingModal.tsx`, `BookingModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (3 nodes): `WhyHSM.tsx`, `WhyHSM.tsx`, `WhyHSM()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (3 nodes): `XPBadge.tsx`, `getRankInfo()`, `XPBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (3 nodes): `Cymbal`, `Snare Drum`, `drums_dark.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (3 nodes): `Microphone`, `Vocals`, `vocals_dark.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `window.svg`, `Window Controls`, `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `drums.png`, `Cymbal`, `Drum`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (2 nodes): `HSM Brand Logo`, `Hyderabad School of Music`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (2 nodes): `Robot Character`, `Full Rotation Sprite Sheet`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (2 nodes): `hsm.org.in`, `Sitemap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (2 nodes): `globe.svg`, `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (2 nodes): `vercel.svg`, `Vercel Triangle Path`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (2 nodes): `Document Concept`, `File Icon (SVG)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 172`** (1 nodes): `Vocals Instrument Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 173`** (1 nodes): `Piano Instrument Photo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 174`** (1 nodes): `Drums Instrument Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 175`** (1 nodes): `Guitar Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 176`** (1 nodes): `Drums Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 177`** (1 nodes): `Vocals Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 178`** (1 nodes): `Piano Dark Mode Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (1 nodes): `Talking Cleff Mascot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 180`** (1 nodes): `Cleff Talking Animation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 181`** (1 nodes): `Cleff Rotating Animation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (1 nodes): `Orange Robot Character`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (1 nodes): `Cleff Animated Mascot`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 184`** (1 nodes): `Rotating Cleff Character`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 185`** (1 nodes): `Piano Keyboard (Dark Lighting)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 186`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 187`** (1 nodes): `White Piano Keyboard Image`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 191`** (1 nodes): `archive/README.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 192`** (1 nodes): `scripts/README.md`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 193`** (1 nodes): `instruments`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 194`** (1 nodes): `batches`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 195`** (1 nodes): `attendance_records`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 196`** (1 nodes): `packages`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 197`** (1 nodes): `teacher_payouts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 198`** (1 nodes): `holidays`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 199`** (1 nodes): `audit_logs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 200`** (1 nodes): `attendance_status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 201`** (1 nodes): `attendance_source`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 202`** (1 nodes): `enrollment_status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 203`** (1 nodes): `holiday_scope`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 204`** (1 nodes): `Vocals`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 205`** (1 nodes): `Carnatik`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiGet()` connect `Community 0` to `Community 3`, `Community 4`, `Community 6`, `Community 9`, `Community 11`, `Community 13`, `Community 15`, `Community 16`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `apiPost()` connect `Community 0` to `Community 1`, `Community 3`, `Community 6`, `Community 9`, `Community 11`, `Community 13`, `Community 15`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `apiPut()` connect `Community 3` to `Community 0`, `Community 11`, `Community 12`, `Community 13`, `Community 15`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 31 inferred relationships involving `apiGet()` (e.g. with `fetchData()` and `fetchProfile()`) actually correct?**
  _`apiGet()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `apiPost()` (e.g. with `handleSave()` and `performToggle()`) actually correct?**
  _`apiPost()` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `apiPut()` (e.g. with `saveEdit()` and `gradeTheoryAnswer()`) actually correct?**
  _`apiPut()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `apiDelete()` (e.g. with `archiveHabit()` and `handleDelete()`) actually correct?**
  _`apiDelete()` has 11 INFERRED edges - model-reasoned connections that need verification._