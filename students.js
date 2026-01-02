const express = require('express');
const Student = require('../models/Student');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/students
// @desc    Get all students
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { halqa, stage, status } = req.query;
        const query = {};

        if (halqa) query.halqa = halqa;
        if (stage) query.stage = stage;
        if (status) query.status = status;

        const students = await Student.find(query)
            .populate('halqa', 'name')
            .populate('guardian', 'name phone');

        res.json({
            success: true,
            count: students.length,
            students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/students/:id
// @desc    Get single student
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('halqa')
            .populate('guardian');

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        res.json({ success: true, student });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/students
// @desc    Register new student
// @access  Private (student_affairs)
router.post('/', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const {
            name,
            age,
            dateOfBirth,
            stage,
            halqa: halqaField,
            halqaId,
            guardian: guardianData,
            notes
        } = req.body;

        // Map English stage to Arabic if necessary
        const stageMap = {
            'primary': 'ابتدائي',
            'preparatory': 'إعدادي',
            'secondary': 'ثانوي',
            'university': 'جامعة'
        };
        const finalStage = stageMap[stage] || stage;

        // Create or find guardian
        let guardian;
        if (guardianData && guardianData._id) {
            guardian = await Guardian.findById(guardianData._id);
        } else if (guardianData) {
            guardian = await Guardian.create({
                name: guardianData.name,
                phone: guardianData.phone,
                alternatePhone: guardianData.alternatePhone,
                relationship: guardianData.relationship
            });
        }

        if (!guardian) {
            return res.status(400).json({ message: 'بيانات ولي الأمر مطلوبة' });
        }

        const student = await Student.create({
            name,
            age,
            dateOfBirth,
            stage: finalStage,
            halqa: halqaField || halqaId,
            guardian: guardian._id,
            notes
        });

        const populatedStudent = await Student.findById(student._id)
            .populate('halqa', 'name')
            .populate('guardian');

        res.status(201).json({
            success: true,
            student: populatedStudent
        });
    } catch (error) {
        console.error(error);
        res.status(400).json({ message: error.message || 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/students/:id
// @desc    Update student
// @access  Private
router.put('/:id', protect, async (req, res) => {
    try {
        delete req.body._id;
        delete req.body.createdAt;
        delete req.body.updatedAt;

        let student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        // debug guardian update
        console.log('Update Student Body Guardian:', req.body.guardian, 'Type:', typeof req.body.guardian);

        // Handle Guardian Update
        if (req.body.guardian && typeof req.body.guardian === 'object') {
            const guardianId = student.guardian;
            if (guardianId) {
                await Guardian.findByIdAndUpdate(guardianId, req.body.guardian, { new: true });
                req.body.guardian = guardianId; // Keep the same guardian ID reference
            } else {
                // If for some reason student has no guardian, create one (edge case)
                const newGuardian = await Guardian.create(req.body.guardian);
                req.body.guardian = newGuardian._id;
            }
        }

        console.log('Final Student Body Guardian:', req.body.guardian);

        student = await Student.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('halqa', 'name').populate('guardian');

        res.json({ success: true, student });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/students/halqa/:halqaId
// @desc    Get students by halqa
// @access  Private
router.get('/halqa/:halqaId', protect, async (req, res) => {
    try {
        const students = await Student.find({
            halqa: req.params.halqaId,
            status: 'منتظم'
        }).populate('guardian', 'name phone');

        res.json({
            success: true,
            count: students.length,
            students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   DELETE /api/students/:id
// @desc    Delete student
// @access  Private (Director only)
router.delete('/:id', protect, authorize('director'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        await student.deleteOne();

        res.json({ success: true, message: 'تم حذف الطالب بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});
module.exports = router;        
