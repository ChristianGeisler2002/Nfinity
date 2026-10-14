const multer = require('multer');
const { saveUpload, MAX_FILE_SIZE_BYTES } = require('../core/uploads/storageService');
const { findUserById } = require('../core/auth/userStore');
const { verifySessionToken } = require('../core/auth/sessionToken');

const isProduction = process.env.NODE_ENV === 'production';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
});

function uploadMiddleware(req, res) {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: 'Invalid upload.' });
    try {
      const auth = req.get('authorization') || '';
      const userId = verifySessionToken(auth.replace(/^Bearer\s+/i, ''));
      const user = userId ? await findUserById(userId) : null;
      // No anonymous uploads in production: a valid session + company is required
      // so files are never written to S3 under an unassigned companyId.
      if (user?.status === 'disabled') return res.status(403).json({ error: 'Account disabled.' });
      if (isProduction && !(user && (user.company_id || user.client_id))) {
        return res.status(401).json({ error: 'Authentication required.' });
      }
      const record = await saveUpload(req.file, {
        userId: user?.id || null,
        companyId: user?.company_id || user?.client_id || null,
      });
      return res.status(201).json({ file: record });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Upload failed.' });
    }
  });
}

module.exports = uploadMiddleware;
