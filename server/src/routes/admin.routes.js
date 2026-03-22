const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  updateRequestedRole,
  approveUser,
  rejectUser,
} = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/role.middleware');

router.use(authenticate);
router.use(requireAdmin);

router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/requested-role', updateRequestedRole);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);

module.exports = router;
