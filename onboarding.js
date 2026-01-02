const express = require('express');
const Student = require('../models/Student');
const Guardian = require('../models/Guardian');
const Interview = require('../models/Interview');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/onboarding/new
// @desc    Create new student application
// @access  Private (student_affairs)
router.post('/new', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const { name, stage, guardian: guardianData, notes } = req.body;

        // Create guardian first
        const guardian = await Guardian.create({
            name: guardianData.name,
            phone: guardianData.phone,
            alternatePhone: guardianData.alternatePhone,
            relationship: guardianData.relationship || 'أب',
            whatsAppEnabled: guardianData.whatsAppEnabled !== false
        });

        // Create student with New status
        const student = await Student.create({
            name,
            stage,
            guardian: guardian._id,
            notes,
            applicationStatus: 'New',
            isActive: false
        });

        const populatedStudent = await Student.findById(student._id)
            .populate('guardian');

        res.status(201).json({
            success: true,
            message: 'تم تسجيل الطالب الجديد',
            student: populatedStudent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/onboarding/:id/form-given
// @desc    Mark application form as given
// @access  Private (student_affairs)
router.put('/:id/form-given', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        if (student.applicationStatus !== 'New') {
            return res.status(400).json({ message: 'لا يمكن تغيير الحالة - الاستمارة أُعطيت بالفعل' });
        }

        student.applicationStatus = 'FormGiven';
        await student.save();

        res.json({
            success: true,
            message: 'تم تسليم الاستمارة',
            student
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/onboarding/:id/form-submitted
// @desc    Submit application form with full data
// @access  Private (student_affairs)
router.put('/:id/form-submitted', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const { name, age, dateOfBirth, stage, guardian: guardianData, notes } = req.body;

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        if (!['New', 'FormGiven'].includes(student.applicationStatus)) {
            return res.status(400).json({ message: 'لا يمكن تقديم الاستمارة في هذه المرحلة' });
        }

        // Update guardian data
        if (guardianData) {
            await Guardian.findByIdAndUpdate(student.guardian, guardianData);
        }

        // Update student data
        student.name = name || student.name;
        student.age = age;
        student.dateOfBirth = dateOfBirth;
        student.stage = stage || student.stage;
        student.notes = notes;
        student.applicationStatus = 'FormSubmitted';

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .populate('guardian');

        res.json({
            success: true,
            message: 'تم تقديم الاستمارة بنجاح',
            student: updatedStudent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   POST /api/onboarding/:id/schedule-interview
// @desc    Auto-schedule interview for student
// @access  Private (student_affairs)
router.post('/:id/schedule-interview', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('guardian');

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        if (student.applicationStatus !== 'FormSubmitted') {
            return res.status(400).json({ message: 'يجب تقديم الاستمارة أولاً قبل جدولة المقابلة' });
        }

        // Get next available slot
        const nextSlot = await Interview.getNextAvailableSlot();

        // Find the manager (director)
        const manager = await User.findOne({ role: 'director', isActive: true });

        if (!manager) {
            return res.status(400).json({ message: 'لا يوجد مدير متاح لإجراء المقابلة' });
        }

        // Create interview
        const interview = await Interview.create({
            student: student._id,
            scheduledDate: nextSlot.date,
            scheduledBy: req.user._id,
            conductor: manager._id,
            dayOfWeek: nextSlot.dayOfWeek,
            status: 'scheduled'
        });

        // Update student status
        student.applicationStatus = 'InterviewScheduled';
        student.interviewDate = nextSlot.date;
        await student.save();

        // Create notification for manager
        await Notification.createInterviewNotification(
            manager._id,
            student.name,
            nextSlot.date,
            interview._id
        );

        res.json({
            success: true,
            message: `تم جدولة المقابلة يوم ${nextSlot.dayOfWeek} بعد صلاة العصر`,
            interview,
            student
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   PUT /api/onboarding/:id/interview-result
// @desc    Set interview result (Manager only)
// @access  Private (director)
router.put('/:id/interview-result', protect, authorize('director'), async (req, res) => {
    try {
        const { result, notes, halqa } = req.body;

        if (!['accepted', 'rejected', 'pending'].includes(result)) {
            return res.status(400).json({ message: 'نتيجة غير صالحة' });
        }

        const student = await Student.findById(req.params.id);

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        if (student.applicationStatus !== 'InterviewScheduled') {
            return res.status(400).json({ message: 'لا توجد مقابلة مجدولة لهذا الطالب' });
        }

        // Update interview
        const interview = await Interview.findOneAndUpdate(
            { student: student._id, status: 'scheduled' },
            {
                status: 'completed',
                result,
                notes,
                conductedAt: new Date()
            },
            { new: true }
        );

        // Update student based on result
        student.applicationStatus = result === 'accepted' ? 'Accepted' :
            result === 'rejected' ? 'Rejected' : 'Pending';
        student.interviewNotes = notes;

        if (result === 'accepted') {
            student.isActive = true;
            student.acceptedAt = new Date();
            student.acceptedBy = req.user._id;

            if (halqa) {
                student.halqa = halqa;
            }
        }

        await student.save();

        const updatedStudent = await Student.findById(student._id)
            .populate('guardian')
            .populate('halqa', 'name');

        res.json({
            success: true,
            message: result === 'accepted' ? 'تم قبول الطالب' :
                result === 'rejected' ? 'تم رفض الطالب' : 'الطالب في قائمة الانتظار',
            student: updatedStudent,
            interview
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/onboarding/pending
// @desc    Get all pending applications
// @access  Private (student_affairs, director)
router.get('/pending', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const students = await Student.find({
            applicationStatus: { $in: ['New', 'FormGiven', 'FormSubmitted', 'InterviewScheduled', 'Pending'] }
        })
            .populate('guardian')
            .sort({ createdAt: -1 });

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

// @route   GET /api/onboarding/interviews
// @desc    Get scheduled interviews (for Manager dashboard)
// @access  Private (director)
router.get('/interviews', protect, authorize('director'), async (req, res) => {
    try {
        const interviews = await Interview.find({
            status: 'scheduled',
            scheduledDate: { $gte: new Date() }
        })
            .populate('student', 'name stage')
            .populate('scheduledBy', 'name')
            .sort({ scheduledDate: 1 });

        res.json({
            success: true,
            count: interviews.length,
            interviews
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
