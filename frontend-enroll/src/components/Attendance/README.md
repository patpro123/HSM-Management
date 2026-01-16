/**
 * Attendance Module - README
 * 
 * This folder contains the attendance marking and viewing components for HSM.
 * 
 * Components:
 * 1. AttendanceTab.jsx - Main attendance tab with date/batch selection and marking
 * 2. BatchSelector.jsx - Batch selection card grid
 * 3. AttendanceList.jsx - Student list with status toggles
 * 4. HistoricalAttendance.jsx - Admin-only view for past attendance records
 * 
 * Features:
 * - Mobile-first responsive design
 * - Batch-centric workflow
 * - "Mark All Present/Absent" bulk actions
 * - Date picker for past or current day attendance
 * - Role-based access (teachers mark current day, admins can mark any day)
 * - Success/error handling with user feedback
 * 
 * Usage:
 * Import AttendanceTab in your main dashboard/layout:
 * 
 *   import AttendanceTab from './components/Attendance/AttendanceTab'
 *   
 *   // In your page/component:
 *   <AttendanceTab />
 * 
 * API Endpoints Expected:
 * - GET /api/batches?date=YYYY-MM-DD
 * - GET /api/batches/:batchId/students
 * - POST /api/attendance
 * - GET /api/attendance?date=YYYY-MM-DD (for historical records)
 * 
 * Styling:
 * - AttendanceTab.css contains all styles
 * - Mobile-responsive breakpoint at 600px
 * - Color scheme: Primary #3498db (blue), Success #27ae60 (green)
 * 
 * Future Enhancements:
 * - WhatsApp integration for AI-assisted attendance drafts
 * - Offline support with sync on reconnect
 * - Makeup class attendance tracking
 * - Audit logs for admin edits
 * - Export attendance reports
 */

export { default as AttendanceTab } from './AttendanceTab'
export { default as HistoricalAttendance } from './HistoricalAttendance'
export { default as BatchSelector } from './BatchSelector'
export { default as AttendanceList } from './AttendanceList'
