const express = require('express');
const CommunicationLog = require('../models/CommunicationLog');
const Student = require('../models/Student');
const Guardian = require('../models/Guardian');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/communication/log
// @desc    Log that communication occurred (without storing message content)
// @access  Private (student_affairs)
router.post('/log', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const { studentId, guardianId, communicationType, purpose, sessionId, notes } = req.body;

        // Verify student exists
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        // Verify guardian exists
        const guardian = await Guardian.findById(guardianId);
        if (!guardian) {
            return res.status(404).json({ message: 'ولي الأمر غير موجود' });
        }

        const log = await CommunicationLog.create({
            student: studentId,
            guardian: guardianId,
            initiatedBy: req.user._id,
            communicationType: communicationType || 'whatsapp',
            purpose: purpose || 'general',
            session: sessionId,
            notes
        });

        const populatedLog = await CommunicationLog.findById(log._id)
            .populate('student', 'name')
            .populate('guardian', 'name phone')
            .populate('initiatedBy', 'name');

        res.status(201).json({
            success: true,
            message: 'تم تسجيل التواصل',
            log: populatedLog
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/communication/history/:studentId
// @desc    Get communication history for a student
// @access  Private
router.get('/history/:studentId', protect, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const history = await CommunicationLog.getStudentHistory(
            req.params.studentId,
            parseInt(limit)
        );

        res.json({
            success: true,
            count: history.length,
            history
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/communication/today
// @desc    Get today's communications by current user
// @access  Private
router.get('/today', protect, async (req, res) => {
    try {
        const communications = await CommunicationLog.getTodaysByUser(req.user._id);

        res.json({
            success: true,
            count: communications.length,
            communications
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

// @route   GET /api/communication/whatsapp-link
// @desc    Generate WhatsApp link for guardian
// @access  Private (student_affairs)
router.get('/whatsapp-link/:studentId', protect, authorize('student_affairs', 'director'), async (req, res) => {
    try {
        const { message } = req.query;

        const student = await Student.findById(req.params.studentId)
            .populate('guardian');

        if (!student) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }

        if (!student.guardian) {
            return res.status(404).json({ message: 'ولي الأمر غير موجود' });
        }

        const guardian = student.guardian;

        if (!guardian.whatsAppEnabled) {
            return res.status(400).json({ message: 'التواصل عبر واتساب غير مفعل لولي الأمر' });
        }

        // Get WhatsApp number
        let phone = guardian.getWhatsAppNumber();

        // Clean phone number (remove spaces, dashes, etc.)
        phone = phone.replace(/[\s\-\(\)]/g, '');

        // Ensure it starts with country code
        if (phone.startsWith('0')) {
            phone = '20' + phone.substring(1); // Egypt country code
        }
        if (!phone.startsWith('+')) {
            phone = '+' + phone;
        }

        // Default message
        const defaultMessage = `السلام عليكم ورحمة الله وبركاته\n\nولي أمر الطالب: ${student.name}\n\nمركز المدارج لتحفيظ القرآن الكريم`;

        const finalMessage = message || defaultMessage;
        const encodedMessage = encodeURIComponent(finalMessage);

        const whatsappUrl = `https://wa.me/${phone.replace('+', '')}?text=${encodedMessage}`;

        res.json({
            success: true,
            student: {
                _id: student._id,
                name: student.name
            },
            guardian: {
                _id: guardian._id,
                name: guardian.name,
                phone: guardian.phone
            },
            whatsappUrl
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'حدث خطأ في الخادم' });
    }
});

module.exports = router;
