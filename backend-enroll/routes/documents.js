const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/students/:studentId/documents - List documents
router.get('/students/:studentId/documents', async (req, res) => {
  const { studentId } = req.params;
  try {
    // Don't fetch file_data in list view to keep it light
    const result = await pool.query(
      'SELECT id, filename, file_type, uploaded_at FROM student_documents WHERE student_id = $1 ORDER BY uploaded_at DESC',
      [studentId]
    );
    res.json({ documents: result.rows });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:id - Download/View document
router.get('/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM student_documents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/students/:studentId/documents - Upload document
router.post('/students/:studentId/documents', async (req, res) => {
  const { studentId } = req.params;
  const { filename, file_type, file_data } = req.body;

  if (!filename || !file_data) {
    return res.status(400).json({ error: 'Filename and file data are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO student_documents (student_id, filename, file_type, file_data) VALUES ($1, $2, $3, $4) RETURNING id, filename, uploaded_at',
      [studentId, filename, file_type, file_data]
    );
    res.status(201).json({ document: result.rows[0], message: 'Document uploaded successfully' });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE /api/documents/:id - Delete document
router.delete('/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM student_documents WHERE id = $1', [id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;