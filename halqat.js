const express = require('express');
const Halqa = require('../models/Halqa');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper to check for time overlap
const isTimeOverlap = (start1, end1, start2, end2) => {
    // Convert to minutes for easier comparison
    const toMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    return s1 < e2 && s2 < e1;
};

// @route   GET /api/halqat
// @desc    Get all halqat
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { teacher, supervisor, isActive } = req.query;
        const query = {};

        if (teacher) query.teacher = teacher;
        if (supervisor) query.supervisor = supervisor;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        // If user is supervisor, only show their halqat
        if (req.user.role === 'supervisor') {
            query.supervisor = req.user._id;
        }

        // If user is teacher, only show their halqa
        if (req.user.role === 'teacher') {
            query.teacher = req.user._id;
        }

        const halqat = await Halqa.find(query)
            .populate('classroom', 'name')
            .populate('teacher', 'name')
            .populate('supervisor', 'name');

        // Get student counts for each halqa
        const halqatWithCounts = await Promise.all(
            halqat.map(async (halqa) => {
                const studentCount = await Student.countDocuments({
                    halqa: halqa._id,
                    status: 'منتظم'
                });
                return {
                    ...halqa.toObject(),
                    studentCount
                };
            })
        );

        res.json({
            success: true,
            count: halqat.length,
            halqat: halqatWithCounts
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/halqat/:id
// @desc    Get single halqa
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const halqa = await Halqa.findById(req.params.id)
            .populate('classroom')
            .populate('teacher', 'name email phone')
            .populate('supervisor', 'name email phone');

        if (!halqa) {
            return res.status(404).json({ message: 'الحلقة غير موجودة' });
        }

        const students = await Student.find({ halqa: halqa._id, status: 'منتظم' });

        res.json({
            success: true,
            halqa: {
                ...halqa.toObject(),
                students,
                studentCount: students.length
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/halqat
// @desc    Create halqa
// @access  Private (Director, Supervisor)
router.post('/', protect, authorize('director', 'supervisor'), async (req, res) => {
    try {
        console.log('Creating Halqa with body:', JSON.stringify(req.body, null, 2));
        const { name, classroom, teacher, supervisor, days, startTime, endTime, maxStudents } = req.body;

        // Check if teacher is already assigned to another halqa on same days AND overlapping time
        const conflictingTeacherHalqat = await Halqa.find({
            teacher,
            days: { $in: days },
            isActive: true
        });

        for (const existingHalqa of conflictingTeacherHalqat) {
            if (isTimeOverlap(startTime, endTime, existingHalqa.startTime, existingHalqa.endTime)) {
                return res.status(400).json({
                    message: `المعلم مرتبط بحلقة "${existingHalqa.name}" من ${existingHalqa.startTime} إلى ${existingHalqa.endTime} في نفس الأيام`
                });
            }
        }

        // Check classroom availability
        const conflictingClassroomHalqat = await Halqa.find({
            classroom,
            days: { $in: days },
            isActive: true
        });

        for (const existingHalqa of conflictingClassroomHalqat) {
            if (isTimeOverlap(startTime, endTime, existingHalqa.startTime, existingHalqa.endTime)) {
                return res.status(400).json({
                    message: `الفصل مستخدم في حلقة "${existingHalqa.name}" من ${existingHalqa.startTime} إلى ${existingHalqa.endTime} في نفس الأيام`
                });
            }
        }

        const halqa = await Halqa.create({
            name,
            classroom,
            teacher,
            supervisor,
            days,
            startTime,
            endTime,
            maxStudents
        });

        const populatedHalqa = await Halqa.findById(halqa._id)
            .populate('classroom', 'name')
            .populate('teacher', 'name')
            .populate('supervisor', 'name');

        res.status(201).json({
            success: true,
            halqa: populatedHalqa
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

// @route   PUT /api/halqat/:id
// @desc    Update halqa
// @access  Private (Director, Supervisor)
router.put('/:id', protect, authorize('director', 'supervisor'), async (req, res) => {
    try {
        delete req.body._id;
        delete req.body.createdAt;
        delete req.body.updatedAt;

        const halqa = await Halqa.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )
            .populate('classroom', 'name')
            .populate('teacher', 'name')
            .populate('supervisor', 'name');

        if (!halqa) {
            return res.status(404).json({ message: 'الحلقة غير موجودة' });
        }

        res.json({ success: true, halqa });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

// @route   DELETE /api/halqat/:id
// @desc    Delete halqa
// @access  Private (Director only)
router.delete('/:id', protect, authorize('director'), async (req, res) => {
    try {
        console.log('Deleting Halqa with ID:', req.params.id);
        const halqa = await Halqa.findById(req.params.id);

        if (!halqa) {
            return res.status(404).json({ message: 'الحلقة غير موجودة' });
        }

        await halqa.deleteOne();

        res.json({ success: true, message: 'تم حذف الحلقة بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
