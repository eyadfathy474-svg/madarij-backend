const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Director, Supervisor)
router.get('/', protect, authorize('director', 'supervisor'), async (req, res) => {
    try {
        const { role, isActive } = req.query;
        const query = {};

        if (role) query.role = role;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const users = await User.find(query).select('-password').populate('assignedHalqat');

        res.json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password').populate('assignedHalqat');

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/users
// @desc    Create user
// @access  Private (Director only)
router.post('/', protect, authorize('director'), async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
        }

        const user = await User.create({
            name,
            email,
            password,
            role,
            phone
        });

        res.status(201).json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Director only)
router.put('/:id', protect, authorize('director'), async (req, res) => {
    try {
        const { name, email, role, phone, isActive, assignedHalqat } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role, phone, isActive, assignedHalqat },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete - deactivate)
// @access  Private (Director only)
router.delete('/:id', protect, authorize('director'), async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }

        res.json({ success: true, message: 'تم إلغاء تفعيل المستخدم' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
