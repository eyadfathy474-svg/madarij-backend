const express = require('express');
const Classroom = require('../models/Classroom');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/classrooms
// @desc    Get all classrooms
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const classrooms = await Classroom.find({ isActive: true });
        res.json({
            success: true,
            count: classrooms.length,
            classrooms
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/classrooms
// @desc    Create classroom
// @access  Private (Director)
router.post('/', protect, authorize('director'), async (req, res) => {
    try {
        const { name, capacity, description } = req.body;

        const classroom = await Classroom.create({
            name,
            capacity,
            description
        });

        res.status(201).json({
            success: true,
            classroom
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/classrooms/:id
// @desc    Update classroom
// @access  Private (Director)
router.put('/:id', protect, authorize('director'), async (req, res) => {
    try {
        const classroom = await Classroom.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!classroom) {
            return res.status(404).json({ message: 'الفصل غير موجود' });
        }

        res.json({ success: true, classroom });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
